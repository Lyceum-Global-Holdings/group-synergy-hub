import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, AlertCircle } from "lucide-react";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { AccountTreeView } from "./AccountTreeView";
import { CreateAccountDialog } from "./CreateAccountDialog";
import { CreateJournalEntryWizard } from "./CreateJournalEntryWizard";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCompany } from "@/contexts/CompanyContext";

export function ChartOfAccountsTab() {
  const { accounts, accountTree, isLoading } = useChartOfAccounts();
  const { selectedCompany, isViewingAllCompanies } = useCompany();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showJournalWizard, setShowJournalWizard] = useState(false);

  const filteredAccounts = accounts?.filter(
    (acc) =>
      acc.account_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.account_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowJournalWizard(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Entry
          </Button>
          <Button 
            size="sm" 
            onClick={() => setCreateDialogOpen(true)}
            disabled={!selectedCompany}
            title={!selectedCompany ? "Select a company first" : "Add new account"}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        </div>
      </div>

      {/* Warning when viewing all companies */}
      {isViewingAllCompanies && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Select a specific company to create or manage accounts.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Accounts</div>
          <div className="text-2xl font-bold mt-1">{accounts?.length || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Assets</div>
          <div className="text-2xl font-bold mt-1">
            {accounts?.filter((a) => a.account_type === "asset").length || 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Liabilities</div>
          <div className="text-2xl font-bold mt-1">
            {accounts?.filter((a) => a.account_type === "liability").length || 0}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Equity</div>
          <div className="text-2xl font-bold mt-1">
            {accounts?.filter((a) => a.account_type === "equity").length || 0}
          </div>
        </Card>
      </div>

      {/* Account Tree */}
      <Card className="p-6">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading accounts...</div>
        ) : filteredAccounts && filteredAccounts.length > 0 ? (
          <AccountTreeView accounts={searchQuery ? filteredAccounts : accountTree} />
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No accounts found</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create First Account
            </Button>
          </div>
        )}
      </Card>

      <CreateAccountDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      <CreateJournalEntryWizard open={showJournalWizard} onOpenChange={setShowJournalWizard} />
    </div>
  );
}
