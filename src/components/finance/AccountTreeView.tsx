import { useState } from "react";
import { ChevronRight, ChevronDown, Edit, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { ChartOfAccount } from "@/types/generalLedger";
import { EditAccountDialog } from "./EditAccountDialog";
import { AccountDetailsDialog } from "./AccountDetailsDialog";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AccountTreeViewProps {
  accounts: (ChartOfAccount & { children?: any[] })[];
  level?: number;
}

export function AccountTreeView({ accounts, level = 0 }: AccountTreeViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { deleteAccount } = useChartOfAccounts();

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const handleView = (account: ChartOfAccount) => {
    setSelectedAccount(account);
    setShowDetailsDialog(true);
  };

  const handleEdit = (account: ChartOfAccount) => {
    setSelectedAccount(account);
    setShowEditDialog(true);
  };

  const handleDeleteClick = (account: ChartOfAccount) => {
    setSelectedAccount(account);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedAccount) {
      try {
        await deleteAccount.mutateAsync(selectedAccount.id);
        toast.success("Account deleted successfully");
        setShowDeleteDialog(false);
        setSelectedAccount(null);
      } catch (error) {
        toast.error("Failed to delete account");
      }
    }
  };

  const getAccountTypeColor = (type: string) => {
    const colors = {
      asset: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      liability: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      equity: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      revenue: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      expense: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="space-y-1">
      {accounts.map((account) => {
        const hasChildren = account.children && account.children.length > 0;
        const isExpanded = expandedIds.has(account.id);

        return (
          <div key={account.id}>
            <div
              className={cn(
                "flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group",
                level > 0 && "ml-6"
              )}
            >
              {hasChildren ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => toggleExpand(account.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              ) : (
                <div className="w-6" />
              )}

              <div className="flex-1 flex items-center gap-3">
                <span className="font-mono text-sm font-medium">{account.account_code}</span>
                <span className="font-medium">{account.account_name}</span>
                <Badge variant="secondary" className={cn("text-xs", getAccountTypeColor(account.account_type))}>
                  {account.account_type}
                </Badge>
                {account.is_header && (
                  <Badge variant="outline" className="text-xs">
                    Header
                  </Badge>
                )}
              </div>

              {!account.is_header && (
                <div className="text-sm font-medium text-right min-w-[120px]">
                  {formatCurrency(account.current_balance)}
                </div>
              )}

              <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleView(account)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(account)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDeleteClick(account)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {hasChildren && isExpanded && (
              <AccountTreeView accounts={account.children} level={level + 1} />
            )}
          </div>
        );
      })}

      {selectedAccount && (
        <>
          <EditAccountDialog
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
            account={selectedAccount}
          />
          <AccountDetailsDialog
            open={showDetailsDialog}
            onOpenChange={setShowDetailsDialog}
            account={selectedAccount}
          />
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete account "{selectedAccount.account_code} - {selectedAccount.account_name}". 
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
