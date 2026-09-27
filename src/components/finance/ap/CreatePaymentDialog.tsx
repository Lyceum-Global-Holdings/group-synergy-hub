import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const paymentSchema = z.object({
  payment_number: z.string().min(1, "Payment number is required").max(50, "Payment number is too long"),
  supplier_id: z.string().min(1, "Supplier is required"),
  payment_date: z.string().min(1, "Payment date is required"),
  payment_method: z.string().min(1, "Payment method is required"),
  total_amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    { message: "Amount must be a positive number" }
  ),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface Props { open: boolean; onOpenChange: (open: boolean) => void; }

export function CreatePaymentDialog({ open, onOpenChange }: Props) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      payment_number: '',
      supplier_id: '',
      payment_date: '',
      payment_method: '',
      total_amount: '',
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', selectedCompany?.id],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('id, name').order('name').eq('company_id', selectedCompany?.id);
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const mutation = useMutation({
    mutationFn: async (values: PaymentFormValues) => {
      const { error } = await supabase.from('supplier_payments').insert({
        payment_number: values.payment_number,
        supplier_id: values.supplier_id,
        payment_date: values.payment_date,
        payment_method: values.payment_method,
        total_amount: parseFloat(values.total_amount),
        company_id: selectedCompany?.id,
        status: 'draft'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      toast.success('Payment created');
      form.reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (values: PaymentFormValues) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Payment</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="payment_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Number</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., PAY-001" />
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
            <FormField
              control={form.control}
              name="payment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date</FormLabel>
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
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="wire">Wire Transfer</SelectItem>
                      <SelectItem value="ach">ACH</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
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
                {mutation.isPending ? "Creating..." : "Create Payment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
