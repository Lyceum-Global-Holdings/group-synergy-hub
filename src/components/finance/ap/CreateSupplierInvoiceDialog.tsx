import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { usePaymentTerms } from "@/hooks/finance/usePaymentTerms";
import { useCurrencies } from "@/hooks/finance/useCurrencies";
import { useTaxTemplates } from "@/hooks/finance/useTaxTemplates";
import { addDays, format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { untypedRpc } from "@/lib/untypedRpc";

// Purchase orders that can be invoiced; an invoice tied to one goes through the
// three-way match and can't be paid until the match is accepted.
const INVOICEABLE = ["approved", "sent", "acknowledged", "partially_received", "completed"];
const NO_PO = "none";

interface PoLine {
  id: string;
  item_code: string | null;
  item_name: string;
  quantity_ordered: number;
  quantity_received: number | null;
  unit_price: number;
  unit_of_measure: string;
}

const invoiceSchema = z.object({
  invoice_number: z.string().min(1, "Invoice number is required").max(50, "Invoice number is too long"),
  supplier_id: z.string().min(1, "Supplier is required"),
  invoice_date: z.string().min(1, "Invoice date is required"),
  due_date: z.string().min(1, "Due date is required"),
  gross_amount: z.string().optional(),
  po_id: z.string().optional(),
  payment_terms_id: z.string().optional(),
  currency: z.string().optional(),
  tax_template_id: z.string().optional(),
}).refine(
  (data) => new Date(data.due_date) >= new Date(data.invoice_date),
  { message: "Due date must be on or after invoice date", path: ["due_date"] }
).refine(
  // Without a PO the amount is typed in; with one it comes from the lines.
  (data) => (data.po_id && data.po_id !== NO_PO) || (!isNaN(parseFloat(data.gross_amount ?? "")) && parseFloat(data.gross_amount ?? "") > 0),
  { message: "Amount must be a positive number", path: ["gross_amount"] }
);

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

interface Props { open: boolean; onOpenChange: (open: boolean) => void; }

export function CreateSupplierInvoiceDialog({ open, onOpenChange }: Props) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const { paymentTerms } = usePaymentTerms();
  const { currencies, exchangeRates } = useCurrencies();
  const { taxTemplates, taxDetails } = useTaxTemplates();

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoice_number: '',
      supplier_id: '',
      invoice_date: '',
      due_date: '',
      gross_amount: '',
      po_id: NO_PO,
      payment_terms_id: '',
      currency: '',
      tax_template_id: '',
    },
  });

  const watchInvoiceDate = form.watch('invoice_date');
  const watchPaymentTermsId = form.watch('payment_terms_id');
  const watchGrossAmount = form.watch('gross_amount');
  const watchCurrency = form.watch('currency');
  const watchTaxTemplateId = form.watch('tax_template_id');
  const watchSupplierId = form.watch('supplier_id');
  const watchPoId = form.watch('po_id');
  const linkedPo = !!watchPoId && watchPoId !== NO_PO;
  // po_item_id → {quantity, unit_price} typed for this invoice
  const [lineInputs, setLineInputs] = useState<Record<string, { quantity: string; unit_price: string }>>({});

  // Auto-calculate due date when payment terms change
  useEffect(() => {
    if (watchInvoiceDate && watchPaymentTermsId) {
      const selectedTerm = paymentTerms?.find(t => t.id === watchPaymentTermsId);
      if (selectedTerm?.credit_days) {
        const invoiceDate = new Date(watchInvoiceDate);
        const dueDate = addDays(invoiceDate, selectedTerm.credit_days);
        form.setValue('due_date', format(dueDate, 'yyyy-MM-dd'));
      }
    }
  }, [watchInvoiceDate, watchPaymentTermsId, paymentTerms, form]);

  // Get exchange rate for selected currency
  const selectedCurrencyRate = watchCurrency ? 
    exchangeRates?.find(r => r.from_currency === watchCurrency)?.exchange_rate || 1 
    : 1;

  // Calculate tax rate from template details
  const selectedTaxRate = useMemo(() => {
    if (!watchTaxTemplateId || !taxDetails) return 0;
    const templateDetails = taxDetails.filter(d => d.template_id === watchTaxTemplateId);
    return templateDetails.reduce((sum, d) => sum + (d.tax_rate || 0), 0);
  }, [watchTaxTemplateId, taxDetails]);

  const { data: purchaseOrders } = useQuery({
    queryKey: ['invoiceable-pos', selectedCompany?.id, watchSupplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id, po_number, status, currency, payment_terms, items:po_items(id, item_code, item_name, quantity_ordered, quantity_received, unit_price, unit_of_measure)')
        .eq('company_id', selectedCompany!.id)
        .eq('supplier_id', watchSupplierId)
        .in('status', INVOICEABLE as any)
        .order('po_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ id: string; po_number: string; status: string; currency: string | null; payment_terms: string | null; items: PoLine[] }>;
    },
    enabled: open && !!selectedCompany?.id && !!watchSupplierId,
  });
  const po = linkedPo ? purchaseOrders?.find((p) => p.id === watchPoId) : undefined;

  // A new supplier clears the PO; a new PO starts its lines from what was received, at the PO price.
  useEffect(() => { form.setValue('po_id', NO_PO); }, [watchSupplierId, form]);
  useEffect(() => {
    if (!po) { setLineInputs({}); return; }
    setLineInputs(Object.fromEntries(po.items.map((i) => [i.id, {
      quantity: Number(i.quantity_received || 0) > 0 ? String(Number(i.quantity_received)) : '',
      unit_price: String(Number(i.unit_price)),
    }])));
    if (!form.getValues('currency') && po.currency) form.setValue('currency', po.currency);
    // Only when a different PO is picked, so a background refetch doesn't wipe what was typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po?.id]);

  const poLines = (po?.items ?? [])
    .map((i) => ({ item: i, qty: parseFloat(lineInputs[i.id]?.quantity ?? ''), price: parseFloat(lineInputs[i.id]?.unit_price ?? '') }))
    .filter((l) => !isNaN(l.qty) && l.qty > 0);
  const poLinesValid = poLines.length > 0 && poLines.every((l) => !isNaN(l.price) && l.price >= 0);
  const poSubtotal = poLines.reduce((sum, l) => sum + Math.round(l.qty * (isNaN(l.price) ? 0 : l.price) * 100) / 100, 0);

  // With a PO, lines are net of tax and tax is added; without one, the typed amount includes tax (as before).
  const grossAmount = linkedPo ? poSubtotal * (1 + selectedTaxRate / 100) : parseFloat(watchGrossAmount ?? '') || 0;
  const taxAmount = linkedPo ? poSubtotal * (selectedTaxRate / 100) : grossAmount * (selectedTaxRate / 100);
  const netAmount = linkedPo ? poSubtotal : grossAmount - taxAmount;
  const baseAmount = grossAmount / selectedCurrencyRate;

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', selectedCompany?.id],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('id, name').order('name').eq('company_id', selectedCompany?.id);
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const mutation = useMutation({
    mutationFn: async (values: InvoiceFormValues) => {
      if (values.po_id && values.po_id !== NO_PO) {
        await untypedRpc<string>('create_supplier_invoice_from_po', {
          p_po_id: values.po_id,
          p_invoice_number: values.invoice_number,
          p_invoice_date: values.invoice_date,
          p_due_date: values.due_date,
          p_lines: poLines.map((l) => ({ po_item_id: l.item.id, quantity: l.qty, unit_price: l.price })),
          p_tax_amount: Math.round(taxAmount * 100) / 100,
          p_currency: values.currency || null,
          p_payment_terms: paymentTerms?.find(t => t.id === values.payment_terms_id)?.name || null,
        });
        return;
      }
      const gross = parseFloat(values.gross_amount ?? '');
      const tax = selectedTaxRate > 0 ? gross * (selectedTaxRate / 100) : 0;
      
      const { error } = await supabase.from('supplier_invoices').insert({
        invoice_number: values.invoice_number,
        supplier_id: values.supplier_id,
        invoice_date: values.invoice_date,
        due_date: values.due_date,
        gross_amount: gross,
        net_amount: gross - tax,
        tax_amount: tax,
        company_id: selectedCompany?.id,
        status: 'draft',
        currency: values.currency || null,
        payment_terms: paymentTerms?.find(t => t.id === values.payment_terms_id)?.name || null,
      });
      if (error) throw error;
    },
    onSuccess: (_, values) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['three-way-match'] });
      toast.success(values.po_id && values.po_id !== NO_PO
        ? 'Invoice created and checked against the purchase order'
        : 'Invoice created');
      form.reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (values: InvoiceFormValues) => {
    mutation.mutate(values);
  };

  const baseCurrency = currencies?.find(c => c.is_base_currency);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={linkedPo ? "max-w-3xl max-h-[90vh] overflow-y-auto" : "max-w-lg"}>
        <DialogHeader><DialogTitle>Create Supplier Invoice</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="invoice_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., INV-001" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {suppliers?.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchSupplierId && (
              <FormField
                control={form.control}
                name="po_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Order</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger aria-label="Purchase order">
                          <SelectValue placeholder="No purchase order" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_PO}>No purchase order (services, utilities)</SelectItem>
                        {purchaseOrders?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.po_number} · {p.status.replace(/_/g, ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {linkedPo
                        ? "Checked against the PO price and the quantities received; it can't be paid until the match is accepted."
                        : "Invoices for goods on a purchase order should be linked so they can be matched."}
                    </p>
                  </FormItem>
                )}
              />
            )}

            {po && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Ordered</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="w-28">Invoiced qty</TableHead>
                      <TableHead className="w-32">Unit price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {po.items.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          {i.item_name}
                          {i.item_code && <div className="text-xs text-muted-foreground">{i.item_code}</div>}
                        </TableCell>
                        <TableCell className="text-right">{Number(i.quantity_ordered)} {i.unit_of_measure}</TableCell>
                        <TableCell className="text-right">{Number(i.quantity_received || 0)}</TableCell>
                        <TableCell>
                          <Input inputMode="decimal" aria-label={`Invoiced quantity of ${i.item_name}`} placeholder="0"
                            value={lineInputs[i.id]?.quantity ?? ''}
                            onChange={(e) => setLineInputs((p) => ({ ...p, [i.id]: { ...p[i.id], quantity: e.target.value } }))} />
                        </TableCell>
                        <TableCell>
                          <Input inputMode="decimal" aria-label={`Invoiced price of ${i.item_name}`}
                            value={lineInputs[i.id]?.unit_price ?? ''}
                            onChange={(e) => setLineInputs((p) => ({ ...p, [i.id]: { ...p[i.id], unit_price: e.target.value } }))} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="invoice_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_terms_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select terms" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentTerms?.map((term) => (
                          <SelectItem key={term.id} value={term.id}>
                            {term.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currencies?.filter(c => c.is_active).map((curr) => (
                          <SelectItem key={curr.id} value={curr.code}>
                            {curr.code} - {curr.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tax_template_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Template</FormLabel>
                    {/* Radix Select can't have an empty item value; "none" stands for no tax. */}
                    <Select onValueChange={(v) => field.onChange(v === 'none' ? '' : v)} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tax" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Tax</SelectItem>
                        {taxTemplates?.map((tax) => {
                          const rate = taxDetails?.filter(d => d.template_id === tax.id)
                            .reduce((sum, d) => sum + (d.tax_rate || 0), 0) || 0;
                          return (
                            <SelectItem key={tax.id} value={tax.id}>
                              {tax.name} ({rate}%)
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!linkedPo && <FormField
              control={form.control}
              name="gross_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gross Amount</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} placeholder="0.00" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />}

            {/* Amount Summary */}
            {grossAmount > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg space-y-1 text-sm">
                {linkedPo && (
                  <div className="flex justify-between font-medium">
                    <span>Invoice total</span>
                    <span>{grossAmount.toFixed(2)}</span>
                  </div>
                )}
                {selectedTaxRate > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax ({selectedTaxRate}%)</span>
                      <span>{taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Net Amount</span>
                      <span>{netAmount.toFixed(2)}</span>
                    </div>
                  </>
                )}
                {watchCurrency && watchCurrency !== baseCurrency?.code && (
                  <div className="flex justify-between text-muted-foreground border-t pt-1 mt-1">
                    <span>Base ({baseCurrency?.code}) Amount</span>
                    <span>{baseAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending || (linkedPo && !poLinesValid)}>
                {mutation.isPending ? "Creating..." : "Create Invoice"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
