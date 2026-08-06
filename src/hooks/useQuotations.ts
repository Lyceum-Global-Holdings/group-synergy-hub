import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCachedUser } from '@/lib/currentUser';
import { toast } from 'sonner';
import type { Quotation, CreateQuotationData, QuotationStatus, InvoiceItem } from '@/types/sales';

const QUOTE_SELECT = `*,
  customer:customers(id, customer_name, customer_code),
  items:sales_quotation_items(*)`;

export function useQuotations(companyId?: string) {
  const queryClient = useQueryClient();

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['sales-quotations', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sales_quotations')
        .select(QUOTE_SELECT)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Quotation[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['sales-quotations'] });
    queryClient.invalidateQueries({ queryKey: ['customer-invoices'] });
  };

  const createQuotation = useMutation({
    mutationFn: async ({ items, ...header }: CreateQuotationData) => {
      if (!items.length) throw new Error('Add at least one line');
      const { data: number, error: numErr } = await (supabase as any).rpc('generate_quotation_number');
      if (numErr) throw numErr;

      const { data: quote, error } = await (supabase as any)
        .from('sales_quotations')
        .insert({ ...header, quote_number: number, created_by: getCachedUser()?.id })
        .select()
        .single();
      if (error) throw error;

      const { error: itemsErr } = await (supabase as any)
        .from('sales_quotation_items')
        .insert(items.map((it, i) => ({ ...it, quotation_id: quote.id, sort_order: it.sort_order ?? i })));
      if (itemsErr) throw itemsErr;

      const { error: recErr } = await (supabase as any).rpc('recompute_quotation_totals', { p_quotation_id: quote.id });
      if (recErr) throw recErr;
      return quote as Quotation;
    },
    onSuccess: (q) => { invalidate(); toast.success(`Quotation ${q.quote_number} created`); },
    onError: (e: any) => toast.error(e.message ?? 'Failed to create quotation'),
  });

  // Draft edit: replace header fields + all lines atomically enough for drafts.
  const updateDraftQuotation = useMutation({
    mutationFn: async ({ id, items, ...header }: CreateQuotationData & { id: string }) => {
      if (!items.length) throw new Error('Add at least one line');
      const { data: fresh, error: freshErr } = await (supabase as any)
        .from('sales_quotations').select('status').eq('id', id).single();
      if (freshErr) throw freshErr;
      if (fresh.status !== 'draft') throw new Error(`Quotation is no longer a draft (${fresh.status})`);

      const { error: hdrErr } = await (supabase as any)
        .from('sales_quotations').update(header).eq('id', id);
      if (hdrErr) throw hdrErr;
      const { error: delErr } = await (supabase as any)
        .from('sales_quotation_items').delete().eq('quotation_id', id);
      if (delErr) throw delErr;
      const { error: insErr } = await (supabase as any)
        .from('sales_quotation_items')
        .insert(items.map((it, i) => ({ ...it, quotation_id: id, sort_order: it.sort_order ?? i })));
      if (insErr) throw insErr;
      const { error: recErr } = await (supabase as any).rpc('recompute_quotation_totals', { p_quotation_id: id });
      if (recErr) throw recErr;
      return id;
    },
    onSuccess: () => { invalidate(); toast.success('Quotation updated'); },
    onError: (e: any) => toast.error(e.message ?? 'Failed to update quotation'),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: QuotationStatus }) => {
      const patch: Record<string, unknown> = { status };
      if (status === 'sent') patch.sent_at = new Date().toISOString();
      if (status === 'accepted' || status === 'rejected') patch.decided_at = new Date().toISOString();
      const { error } = await (supabase as any)
        .from('sales_quotations').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Quotation status updated'); },
    onError: (e: any) => toast.error(e.message ?? 'Failed to update status'),
  });

  const convertToInvoice = useMutation({
    mutationFn: async (quotationId: string) => {
      const { data, error } = await (supabase as any).rpc('convert_quotation_to_invoice', {
        p_quotation_id: quotationId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (inv: any) => { invalidate(); toast.success(`Invoice ${inv.invoice_number} created`); },
    onError: (e: any) => toast.error(e.message ?? 'Failed to convert to invoice'),
  });

  const deleteDraft = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('sales_quotations').delete().eq('id', id).eq('status', 'draft');
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Draft deleted'); },
    onError: (e: any) => toast.error(e.message ?? 'Failed to delete draft'),
  });

  return { quotations, isLoading, createQuotation, updateDraftQuotation, setStatus, convertToInvoice, deleteDraft };
}

// Line items for one AR invoice (used by the Sales invoices page + PDF).
export function useInvoiceItems(invoiceId?: string) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['customer-invoice-items', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('customer_invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as InvoiceItem[];
    },
  });
  return { items, isLoading };
}
