import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

interface CreateBankTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBankTransactionDialog({ open, onOpenChange }: CreateBankTransactionDialogProps) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<{
    bank_account_id: string | undefined;
    transaction_date: string;
    transaction_type: string;
    amount: number;
    reference_number: string;
    description: string;
  }>({
    bank_account_id: undefined,
    transaction_date: new Date().toISOString().split("T")[0],
    transaction_type: "deposit",
    amount: 0,
    reference_number: "",
    description: "",
  });

  const { data: accounts } = useQuery({
    queryKey: ["bank-accounts", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, bank_name, account_name")
        .eq("company_id", selectedCompany?.id)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  const createTransaction = useMutation({
    mutationFn: async () => {
      const isDebit = ["withdrawal", "payment", "fee"].includes(formData.transaction_type);
      const { error } = await supabase.from("bank_transactions").insert({
        bank_account_id: formData.bank_account_id,
        transaction_date: formData.transaction_date,
        transaction_type: formData.transaction_type,
        debit_amount: isDebit ? formData.amount : 0,
        credit_amount: !isDebit ? formData.amount : 0,
        reference_number: formData.reference_number,
        description: formData.description,
        company_id: selectedCompany?.id,
        is_reconciled: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      toast.success("Transaction recorded successfully");
      onOpenChange(false);
      setFormData({
        bank_account_id: undefined,
        transaction_date: new Date().toISOString().split("T")[0],
        transaction_type: "deposit",
        amount: 0,
        reference_number: "",
        description: "",
      });
    },
    onError: (error) => {
      toast.error("Failed to record transaction: " + error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Bank Transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Bank Account</Label>
            <Select
              value={formData.bank_account_id}
              onValueChange={(value) => setFormData({ ...formData, bank_account_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts?.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.bank_name} - {account.account_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Transaction Date</Label>
              <Input
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={formData.transaction_type}
                onValueChange={(value) => setFormData({ ...formData, transaction_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="fee">Bank Fee</SelectItem>
                  <SelectItem value="interest">Interest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                placeholder="e.g., CHQ-001234"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Transaction description..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => createTransaction.mutate()} 
            disabled={!formData.bank_account_id || !formData.amount}
          >
            Record Transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
