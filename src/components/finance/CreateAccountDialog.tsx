import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import type { CreateAccountData, AccountType, AccountCategory, NormalBalance } from "@/types/generalLedger";

interface CreateAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAccountDialog({ open, onOpenChange }: CreateAccountDialogProps) {
  const { createAccount, accounts } = useChartOfAccounts();
  const { register, handleSubmit, watch, setValue, reset } = useForm<CreateAccountData>({
    defaultValues: {
      normal_balance: "debit",
      is_header: false,
      opening_balance: 0,
      currency: "LKR",
    },
  });

  const accountType = watch("account_type");

  const accountCategories: Record<AccountType, { value: AccountCategory; label: string }[]> = {
    asset: [
      { value: "current_asset", label: "Current Asset" },
      { value: "fixed_asset", label: "Fixed Asset" },
      { value: "other_asset", label: "Other Asset" },
    ],
    liability: [
      { value: "current_liability", label: "Current Liability" },
      { value: "long_term_liability", label: "Long-term Liability" },
    ],
    equity: [
      { value: "equity", label: "Equity" },
      { value: "retained_earnings", label: "Retained Earnings" },
    ],
    revenue: [
      { value: "operating_revenue", label: "Operating Revenue" },
      { value: "other_revenue", label: "Other Revenue" },
    ],
    expense: [
      { value: "operating_expense", label: "Operating Expense" },
      { value: "cogs", label: "Cost of Goods Sold" },
      { value: "other_expense", label: "Other Expense" },
    ],
  };

  const onSubmit = (data: CreateAccountData) => {
    createAccount.mutate(data, {
      onSuccess: () => {
        reset();
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Account</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account_code">Account Code *</Label>
              <Input
                id="account_code"
                {...register("account_code", { required: true })}
                placeholder="e.g., 1000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_name">Account Name *</Label>
              <Input
                id="account_name"
                {...register("account_name", { required: true })}
                placeholder="e.g., Cash"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account_type">Account Type *</Label>
              <Select
                onValueChange={(value) => setValue("account_type", value as AccountType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="liability">Liability</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_category">Account Category *</Label>
              <Select
                disabled={!accountType}
                onValueChange={(value) => setValue("account_category", value as AccountCategory)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {accountType &&
                    accountCategories[accountType].map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="normal_balance">Normal Balance *</Label>
              <Select
                defaultValue="debit"
                onValueChange={(value) => setValue("normal_balance", value as NormalBalance)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Debit</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parent_account_id">Parent Account (Optional)</Label>
              <Select onValueChange={(value) => setValue("parent_account_id", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    ?.filter((acc) => acc.is_header)
                    .map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_code} - {acc.account_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="opening_balance">Opening Balance</Label>
              <Input
                id="opening_balance"
                type="number"
                step="0.01"
                {...register("opening_balance", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="opening_balance_date">Opening Balance Date</Label>
              <Input
                id="opening_balance_date"
                type="date"
                {...register("opening_balance_date")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} rows={3} />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_header"
              onCheckedChange={(checked) => setValue("is_header", checked as boolean)}
            />
            <Label htmlFor="is_header" className="font-normal cursor-pointer">
              This is a header account (cannot post transactions directly)
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAccount.isPending}>
              {createAccount.isPending ? "Creating..." : "Create Account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
