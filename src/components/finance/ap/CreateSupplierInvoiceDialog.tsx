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

export function CreateSupplierInvoiceDialog({ open, onOpenChange }: Props) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ invoice_number: '', supplier_id: '', invoice_date: '', due_date: '', gross_amount: '' });

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
      const { error } = await supabase.from('supplier_invoices').insert({
        ...form, gross_amount: parseFloat(form.gross_amount), net_amount: parseFloat(form.gross_amount),
        company_id: selectedCompany?.id, status: 'draft'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-invoices'] });
      toast.success('Invoice created');
      onOpenChange(false);
      setForm({ invoice_number: '', supplier_id: '', invoice_date: '', due_date: '', gross_amount: '' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Supplier Invoice</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Invoice Number</Label><Input value={form.invoice_number} onChange={e => setForm({...form, invoice_number: e.target.value})} /></div>
          <div><Label>Supplier</Label>
            <Select value={form.supplier_id} onValueChange={v => setForm({...form, supplier_id: v})}>
              <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>{suppliers?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Invoice Date</Label><Input type="date" value={form.invoice_date} onChange={e => setForm({...form, invoice_date: e.target.value})} /></div>
            <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} /></div>
          </div>
          <div><Label>Amount</Label><Input type="number" value={form.gross_amount} onChange={e => setForm({...form, gross_amount: e.target.value})} /></div>
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>Create Invoice</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
