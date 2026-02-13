import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { ChartOfAccount, AccountType, AccountCategory, NormalBalance } from "@/types/generalLedger";
import { toast } from "sonner";

interface EditAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: ChartOfAccount;
}

interface AccountFormData {
  account_name: string;
  account_type: AccountType;
  account_category: AccountCategory;
  normal_balance: NormalBalance;
  is_header: boolean;
  is_active: boolean;
  notes?: string;
}

export function EditAccountDialog({ open, onOpenChange, account }: EditAccountDialogProps) {
  const { updateAccount } = useChartOfAccounts();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<AccountFormData>({
    defaultValues: {
      account_name: account.account_name,
      account_type: account.account_type,
      account_category: account.account_category,
      normal_balance: account.normal_balance,
      is_header: account.is_header,
      is_active: account.is_active,
      notes: account.notes || ""
    }
  });

  const accountType = watch("account_type");
  const isHeader = watch("is_header");
  const isActive = watch("is_active");

  const onSubmit = async (data: AccountFormData) => {
    try {
      await updateAccount.mutateAsync({
        ...account,
        ...data,
        id: account.id
      });
      toast.success("Account updated successfully");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to update account");
    }
  };

  const categoryOptions: Record<AccountType, { value: AccountCategory; label: string }[]> = {
    asset: [
      { value: "current_asset", label: "Current Asset" },
      { value: "fixed_asset", label: "Fixed Asset" },
      { value: "other_asset", label: "Other Asset" }
    ],
    liability: [
      { value: "current_liability", label: "Current Liability" },
      { value: "long_term_liability", label: "Long-term Liability" }
    ],
    equity: [
      { value: "equity", label: "Equity" },
      { value: "retained_earnings", label: "Retained Earnings" }
    ],
    revenue: [
      { value: "operating_revenue", label: "Operating Revenue" },
      { value: "other_revenue", label: "Other Revenue" }
    ],
    expense: [
      { value: "operating_expense", label: "Operating Expense" },
      { value: "cogs", label: "Cost of Goods Sold" },
      { value: "other_expense", label: "Other Expense" }
    ]
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Account Code</Label>
              <Input value={account.account_code} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Account code cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label>Account Name *</Label>
              <Input {...register("account_name", { required: true })} />
              {errors.account_name && <span className="text-xs text-destructive">Required</span>}
            </div>

            <div className="space-y-2">
              <Label>Account Type *</Label>
              <Select value={accountType} onValueChange={(value) => setValue("account_type", value as AccountType)}>
                <SelectTrigger>
                  <SelectValue />
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
              <Label>Category *</Label>
              <Select value={watch("account_category")} onValueChange={(value) => setValue("account_category", value as AccountCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions[accountType].map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Normal Balance *</Label>
              <Select value={watch("normal_balance")} onValueChange={(value) => setValue("normal_balance", value as NormalBalance)}>
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
              <Label>Current Balance</Label>
              <Input value={account.current_balance.toFixed(2)} disabled className="bg-muted" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="is_header">Is Header Account</Label>
              <Switch id="is_header" checked={isHeader} onCheckedChange={(checked) => setValue("is_header", checked)} />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Is Active</Label>
              <Switch id="is_active" checked={isActive} onCheckedChange={(checked) => setValue("is_active", checked)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea {...register("notes")} rows={3} placeholder="Additional notes..." />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={updateAccount.isPending}>
              {updateAccount.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
