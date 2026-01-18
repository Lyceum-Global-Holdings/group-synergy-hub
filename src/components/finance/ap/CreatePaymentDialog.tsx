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

export function CreatePaymentDialog({ open, onOpenChange }: Props) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<{
    payment_number: string;
    supplier_id: string | undefined;
    payment_date: string;
    payment_method: string | undefined;
    total_amount: string;
  }>({ payment_number: '', supplier_id: undefined, payment_date: '', payment_method: undefined, total_amount: '' });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', selectedCompany?.id],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('id, supplier_name').eq('company_id', selectedCompany?.id);
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('supplier_payments').insert({
        ...form, total_amount: parseFloat(form.total_amount), company_id: selectedCompany?.id, status: 'draft'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      toast.success('Payment created');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Payment</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Payment Number</Label><Input value={form.payment_number} onChange={e => setForm({...form, payment_number: e.target.value})} /></div>
          <div><Label>Supplier</Label>
            <Select value={form.supplier_id} onValueChange={v => setForm({...form, supplier_id: v})}>
              <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>{suppliers?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Payment Date</Label><Input type="date" value={form.payment_date} onChange={e => setForm({...form, payment_date: e.target.value})} /></div>
          <div><Label>Payment Method</Label>
            <Select value={form.payment_method} onValueChange={v => setForm({...form, payment_method: v})}>
              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="wire">Wire Transfer</SelectItem>
                <SelectItem value="ach">ACH</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Amount</Label><Input type="number" value={form.total_amount} onChange={e => setForm({...form, total_amount: e.target.value})} /></div>
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>Create Payment</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
