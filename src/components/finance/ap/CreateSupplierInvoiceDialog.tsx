import { useEffect, useMemo } from "react";
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

const invoiceSchema = z.object({
  invoice_number: z.string().min(1, "Invoice number is required").max(50, "Invoice number is too long"),
  supplier_id: z.string().min(1, "Supplier is required"),
  invoice_date: z.string().min(1, "Invoice date is required"),
  due_date: z.string().min(1, "Due date is required"),
  gross_amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    { message: "Amount must be a positive number" }
  ),
  payment_terms_id: z.string().optional(),
  currency: z.string().optional(),
  tax_template_id: z.string().optional(),
}).refine(
  (data) => new Date(data.due_date) >= new Date(data.invoice_date),
  { message: "Due date must be on or after invoice date", path: ["due_date"] }
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

  const grossAmount = parseFloat(watchGrossAmount) || 0;
  const taxAmount = grossAmount * (selectedTaxRate / 100);
  const netAmount = grossAmount - taxAmount;
  const baseAmount = grossAmount / selectedCurrencyRate;

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', selectedCompany?.id],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('id, supplier_name').eq('company_id', selectedCompany?.id);
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const mutation = useMutation({
    mutationFn: async (values: InvoiceFormValues) => {
      const gross = parseFloat(values.gross_amount);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      toast.success('Invoice created');
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
      <DialogContent className="max-w-lg">
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
                        <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tax" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No Tax</SelectItem>
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

            <FormField
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
            />

            {/* Amount Summary */}
            {grossAmount > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg space-y-1 text-sm">
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
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Creating..." : "Create Invoice"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
