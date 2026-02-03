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

const receiptSchema = z.object({
  receipt_number: z.string().min(1, "Receipt number is required").max(50, "Receipt number is too long"),
  customer_id: z.string().min(1, "Customer is required"),
  receipt_date: z.string().min(1, "Receipt date is required"),
  payment_method: z.string().min(1, "Payment method is required"),
  total_amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    { message: "Amount must be a positive number" }
  ),
});

type ReceiptFormValues = z.infer<typeof receiptSchema>;

interface Props { open: boolean; onOpenChange: (open: boolean) => void; }

export function CreateReceiptDialog({ open, onOpenChange }: Props) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const form = useForm<ReceiptFormValues>({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      receipt_number: '',
      customer_id: '',
      receipt_date: '',
      payment_method: '',
      total_amount: '',
    },
  });

  const { data: customers } = useQuery({
    queryKey: ['customers-directory', selectedCompany?.id],
    queryFn: async () => {
      // Use secure view - finance users only see customer name/code
      const { data } = await supabase.from('customers_directory').select('id, customer_name').eq('company_id', selectedCompany?.id);
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const mutation = useMutation({
    mutationFn: async (values: ReceiptFormValues) => {
      const { error } = await supabase.from('customer_receipts').insert({
        receipt_number: values.receipt_number,
        customer_id: values.customer_id,
        receipt_date: values.receipt_date,
        payment_method: values.payment_method,
        total_amount: parseFloat(values.total_amount),
        company_id: selectedCompany?.id,
        status: 'draft'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-receipts'] });
      toast.success('Receipt created');
      form.reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (values: ReceiptFormValues) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Receipt</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="receipt_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., RCP-001" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customers?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.customer_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="receipt_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="wire">Wire Transfer</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="total_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} placeholder="0.00" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Creating..." : "Create Receipt"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
