import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

export interface OutstandingInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  gross_amount: number;
  amount_paid: number;
  outstanding: number;
  status: string;
  /** Why it can't be paid yet (a PO invoice whose three-way match isn't accepted), or null. */
  payment_blocked?: string | null;
}

// Matches invoice_payment_block_reason in the database, which refuses the allocation anyway.
export function paymentBlockReason(inv: { po_id?: string | null; three_way_match_status?: string | null }): string | null {
  if (!inv.po_id) return null;
  if (inv.three_way_match_status === 'matched' || inv.three_way_match_status === 'auto_matched') return null;
  return inv.three_way_match_status === 'failed' ? 'Failed three-way match' : 'Waiting for three-way match';
}

export interface PaymentAllocation {
  invoice_id: string;
  allocated_amount: number;
  discount_amount?: number;
}

export function usePaymentAllocation() {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  // Fetch outstanding supplier invoices
  const useOutstandingSupplierInvoices = (supplierId: string) => {
    return useQuery({
      queryKey: ['outstanding-supplier-invoices', selectedCompany?.id, supplierId],
      queryFn: async () => {
        if (!selectedCompany?.id || !supplierId) return [];
        
        const { data, error } = await supabase
          .from('supplier_invoices')
          .select('id, invoice_number, invoice_date, due_date, gross_amount, amount_paid, status, po_id, three_way_match_status')
          .eq('company_id', selectedCompany.id)
          .eq('supplier_id', supplierId)
          .in('status', ['draft', 'submitted', 'approved', 'posted', 'partially_paid'])
          .order('due_date', { ascending: true });
        
        if (error) throw error;
        
        return (data || []).map(inv => ({
          ...inv,
          outstanding: inv.gross_amount - (inv.amount_paid || 0),
          payment_blocked: paymentBlockReason(inv),
        })).filter(inv => inv.outstanding > 0) as OutstandingInvoice[];
      },
      enabled: !!selectedCompany?.id && !!supplierId,
    });
  };

  // Fetch outstanding customer invoices
  const useOutstandingCustomerInvoices = (customerId: string) => {
    return useQuery({
      queryKey: ['outstanding-customer-invoices', selectedCompany?.id, customerId],
      queryFn: async () => {
        if (!selectedCompany?.id || !customerId) return [];
        
        const { data, error } = await supabase
          .from('customer_invoices')
          .select('id, invoice_number, invoice_date, due_date, gross_amount, amount_received, status')
          .eq('company_id', selectedCompany.id)
          .eq('customer_id', customerId)
          .in('status', ['draft', 'submitted', 'approved', 'posted', 'partially_paid'])
          .order('due_date', { ascending: true });
        
        if (error) throw error;
        
        return (data || []).map(inv => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          due_date: inv.due_date,
          gross_amount: inv.gross_amount,
          amount_paid: inv.amount_received || 0,
          status: inv.status || 'draft',
          outstanding: inv.gross_amount - (inv.amount_received || 0),
        })).filter(inv => inv.outstanding > 0) as OutstandingInvoice[];
      },
      enabled: !!selectedCompany?.id && !!customerId,
    });
  };

  // Allocate payment to supplier invoices
  const allocateSupplierPayment = useMutation({
    mutationFn: async ({ paymentId, allocations }: { paymentId: string; allocations: PaymentAllocation[] }) => {
      // Insert allocation records with correct column names
      const allocationRecords = allocations.map(a => ({
        payment_id: paymentId,
        invoice_id: a.invoice_id,
        amount_allocated: a.allocated_amount,
        discount_taken: a.discount_amount || 0,
      }));

      const { error: allocError } = await supabase
        .from('payment_allocations')
        .insert(allocationRecords);

      if (allocError) throw allocError;

      // Update each invoice's amount_paid and status
      for (const allocation of allocations) {
        const { data: invoice } = await supabase
          .from('supplier_invoices')
          .select('gross_amount, amount_paid')
          .eq('id', allocation.invoice_id)
          .single();

        if (invoice) {
          const newAmountPaid = (invoice.amount_paid || 0) + allocation.allocated_amount;
          const newStatus = newAmountPaid >= invoice.gross_amount ? 'paid' : 'partially_paid';

          await supabase
            .from('supplier_invoices')
            .update({ 
              amount_paid: newAmountPaid,
              status: newStatus,
            })
            .eq('id', allocation.invoice_id);
        }
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outstanding-supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      toast.success('Payment allocated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Allocation failed: ${error.message}`);
    },
  });

  // Allocate receipt to customer invoices
  const allocateCustomerReceipt = useMutation({
    mutationFn: async ({ receiptId, allocations }: { receiptId: string; allocations: PaymentAllocation[] }) => {
      // Insert allocation records with correct column names
      const allocationRecords = allocations.map(a => ({
        receipt_id: receiptId,
        invoice_id: a.invoice_id,
        amount_allocated: a.allocated_amount,
        discount_given: a.discount_amount || 0,
      }));

      const { error: allocError } = await supabase
        .from('receipt_allocations')
        .insert(allocationRecords);

      if (allocError) throw allocError;

      // Update each invoice's amount_received and status
      for (const allocation of allocations) {
        const { data: invoice } = await supabase
          .from('customer_invoices')
          .select('gross_amount, amount_received')
          .eq('id', allocation.invoice_id)
          .single();

        if (invoice) {
          const newAmountReceived = (invoice.amount_received || 0) + allocation.allocated_amount;
          const newStatus = newAmountReceived >= invoice.gross_amount ? 'paid' : 'partially_paid';

          await supabase
            .from('customer_invoices')
            .update({ 
              amount_received: newAmountReceived,
              status: newStatus,
            })
            .eq('id', allocation.invoice_id);
        }
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outstanding-customer-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['customer-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['customer-receipts'] });
      toast.success('Receipt allocated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Allocation failed: ${error.message}`);
    },
  });

  return {
    useOutstandingSupplierInvoices,
    useOutstandingCustomerInvoices,
    allocateSupplierPayment,
    allocateCustomerReceipt,
  };
}
