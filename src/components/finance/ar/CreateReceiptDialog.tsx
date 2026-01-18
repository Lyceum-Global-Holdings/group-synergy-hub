import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

interface Props { open: boolean; onOpenChange: (open: boolean) => void; }

export function CreateReceiptDialog({ open, onOpenChange }: Props) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<{
    receipt_number: string;
    customer_id: string | undefined;
    receipt_date: string;
    payment_method: string | undefined;
    total_amount: string;
  }>({ receipt_number: '', customer_id: undefined, receipt_date: '', payment_method: undefined, total_amount: '' });

  const { data: customers } = useQuery({
    queryKey: ['customers', selectedCompany?.id],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('id, customer_name').eq('company_id', selectedCompany?.id);
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('customer_receipts').insert({
        ...form, total_amount: parseFloat(form.total_amount), company_id: selectedCompany?.id, status: 'draft'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-receipts'] });
      toast.success('Receipt created');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Receipt</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Receipt Number</Label><Input value={form.receipt_number} onChange={e => setForm({...form, receipt_number: e.target.value})} /></div>
          <div><Label>Customer</Label>
            <Select value={form.customer_id} onValueChange={v => setForm({...form, customer_id: v})}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>{customers?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.customer_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Receipt Date</Label><Input type="date" value={form.receipt_date} onChange={e => setForm({...form, receipt_date: e.target.value})} /></div>
          <div><Label>Payment Method</Label>
            <Select value={form.payment_method} onValueChange={v => setForm({...form, payment_method: v})}>
              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="wire">Wire Transfer</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Amount</Label><Input type="number" value={form.total_amount} onChange={e => setForm({...form, total_amount: e.target.value})} /></div>
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>Create Receipt</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
