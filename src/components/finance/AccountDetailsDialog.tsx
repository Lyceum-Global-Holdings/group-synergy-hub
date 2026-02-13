import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChartOfAccount } from "@/types/generalLedger";
import { format } from "date-fns";

interface AccountDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: ChartOfAccount;
}

export function AccountDetailsDialog({ open, onOpenChange, account }: AccountDetailsDialogProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: account.currency || 'LKR'
    }).format(amount);
  };

  const getAccountTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      asset: "bg-blue-500/10 text-blue-500",
      liability: "bg-red-500/10 text-red-500",
      equity: "bg-purple-500/10 text-purple-500",
      revenue: "bg-green-500/10 text-green-500",
      expense: "bg-orange-500/10 text-orange-500"
    };
    return colors[type] || "bg-gray-500/10 text-gray-500";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Account Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold">{account.account_name}</h3>
              <p className="text-muted-foreground">Account Code: {account.account_code}</p>
            </div>
            <div className="flex gap-2">
              <Badge className={getAccountTypeBadge(account.account_type)}>
                {account.account_type.toUpperCase()}
              </Badge>
              {account.is_header && <Badge variant="outline">Header</Badge>}
              <Badge variant={account.is_active ? "default" : "secondary"}>
                {account.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Opening Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(account.opening_balance)}</p>
              {account.opening_balance_date && (
                <p className="text-xs text-muted-foreground mt-1">
                  As of {format(new Date(account.opening_balance_date), "MMM dd, yyyy")}
                </p>
              )}
            </Card>

            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(account.current_balance)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {account.normal_balance === 'debit' ? 'Debit Balance' : 'Credit Balance'}
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Category</p>
              <p className="text-lg font-semibold capitalize">
                {account.account_category.replace(/_/g, ' ')}
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Level</p>
              <p className="text-2xl font-bold">{account.level}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {account.is_control_account ? 'Control Account' : 'Detail Account'}
              </p>
            </Card>
          </div>

          {/* Account Information */}
          <div className="space-y-4">
            <h4 className="font-semibold">Account Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Currency:</span>
                <span className="ml-2 font-medium">{account.currency || 'LKR'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Normal Balance:</span>
                <span className="ml-2 font-medium capitalize">{account.normal_balance}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>
                <span className="ml-2 font-medium">{format(new Date(account.created_at), "MMM dd, yyyy")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Last Updated:</span>
                <span className="ml-2 font-medium">{format(new Date(account.updated_at), "MMM dd, yyyy")}</span>
              </div>
            </div>
          </div>

          {account.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold">Notes</h4>
                <p className="text-sm text-muted-foreground">{account.notes}</p>
              </div>
            </>
          )}

          {/* Transaction History Placeholder */}
          <Separator />
          <div className="space-y-4">
            <h4 className="font-semibold">Recent Transactions</h4>
            <div className="border rounded-lg p-8 text-center text-muted-foreground">
              <p>Transaction history will be available once journal entries are posted to this account.</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
