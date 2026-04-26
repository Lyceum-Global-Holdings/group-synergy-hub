import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FileDown, FileUp, BarChart3 } from "lucide-react";
import { GenerateReportButton } from "@/components/management/reports/GenerateReportButton";
import { ChartOfAccountsTab } from "@/components/finance/ChartOfAccountsTab";
import { JournalEntriesTab } from "@/components/finance/JournalEntriesTab";
import { FinancialReportsTab } from "@/components/finance/FinancialReportsTab";
import { AccountingPeriodsTab } from "@/components/finance/AccountingPeriodsTab";
import { GLSettingsTab } from "@/components/finance/GLSettingsTab";
import { CreateJournalEntryWizard } from "@/components/finance/CreateJournalEntryWizard";
import { useState } from "react";
import { toast } from "sonner";

export default function GeneralLedger() {
  const [activeTab, setActiveTab] = useState("coa");
  const [showJournalWizard, setShowJournalWizard] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">General Ledger</h1>
          <p className="text-muted-foreground mt-1">
            Manage your chart of accounts, journal entries, and financial reports
          </p>
        </div>
        <div className="flex gap-2">
          <GenerateReportButton size="sm" templates={["FN-GL-001", "FN-TB-001"]} />
          <Button variant="outline" size="sm" onClick={() => toast.info("Export feature coming soon")}>
            <FileDown className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Import feature coming soon")}>
            <FileUp className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button size="sm" onClick={() => setShowJournalWizard(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Entry
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="coa">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="journal">Journal Entries</TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 className="h-4 w-4 mr-2" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="periods">Periods</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="coa" className="space-y-4">
          <ChartOfAccountsTab />
        </TabsContent>

        <TabsContent value="journal" className="space-y-4">
          <JournalEntriesTab />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <FinancialReportsTab />
        </TabsContent>

        <TabsContent value="periods" className="space-y-4">
          <AccountingPeriodsTab />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <GLSettingsTab />
        </TabsContent>
      </Tabs>

      <CreateJournalEntryWizard
        open={showJournalWizard}
        onOpenChange={setShowJournalWizard}
      />
    </div>
  );
}
