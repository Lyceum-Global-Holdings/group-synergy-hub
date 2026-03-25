import { useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { ChartOfAccountsTab } from "@/components/finance/ChartOfAccountsTab";
import { JournalEntriesTab } from "@/components/finance/JournalEntriesTab";
import { FinancialReportsTab } from "@/components/finance/FinancialReportsTab";
import { AccountingPeriodsTab } from "@/components/finance/AccountingPeriodsTab";
import { GLSettingsTab } from "@/components/finance/GLSettingsTab";
import { CreateJournalEntryWizard } from "@/components/finance/CreateJournalEntryWizard";
import { QuickActions } from "../QuickActions";
import { KPICard } from "../KPICard";
import { Plus, FileDown, Calendar, LayoutDashboard, BookOpen, DollarSign, Clock, ShieldCheck } from "lucide-react";
import { useLedgerSummary } from "@/hooks/finance/useGeneralLedger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlaceholderContent } from "../PlaceholderContent";

const subTabs = [
  { id: "dashboard", label: "Dashboard" },
  { id: "chart-of-accounts", label: "Chart of Accounts" },
  { id: "journal-entries", label: "Journal Entries" },
  { id: "reports", label: "Reports" },
  { id: "periods", label: "Periods" },
  { id: "recurring", label: "Recurring" },
  { id: "currencies", label: "Currencies" },
  { id: "settings", label: "Settings" },
];

interface GLModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function GLModule({ activeSubTab, onSubTabChange }: GLModuleProps) {
  const [showJournalWizard, setShowJournalWizard] = useState(false);
  const { data: summary } = useLedgerSummary();

  const quickActions = [
    { label: "New Journal Entry", icon: Plus, onClick: () => setShowJournalWizard(true) },
    { label: "Export", icon: FileDown, onClick: () => {} },
    { label: "Period Closing", icon: Calendar, onClick: () => onSubTabChange("periods") },
  ];

  return (
    <>
      <ModuleSubTabs tabs={subTabs} activeTab={activeSubTab || "dashboard"} onTabChange={onSubTabChange}>
        <TabsContent value="dashboard" className="mt-4 space-y-6">
          <QuickActions actions={quickActions} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              icon={BookOpen}
              label="Active Accounts"
              value={summary?.totalAccounts ?? "—"}
              variant="primary"
            />
            <KPICard
              icon={DollarSign}
              label="Posted Entries"
              value={summary?.postedEntries ?? "—"}
              variant="success"
            />
            <KPICard
              icon={Clock}
              label="Draft Entries"
              value={summary?.draftEntries ?? "—"}
              variant="warning"
            />
            <KPICard
              icon={ShieldCheck}
              label="Open Periods"
              value={summary?.openPeriods ?? "—"}
              variant="default"
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Recent Journal Entries</CardTitle></CardHeader>
              <CardContent>
                <JournalEntriesTab />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Financial Overview</CardTitle></CardHeader>
              <CardContent>
                <FinancialReportsTab />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="chart-of-accounts" className="mt-4 space-y-6">
          <QuickActions actions={quickActions} />
          <ChartOfAccountsTab />
        </TabsContent>

        <TabsContent value="journal-entries" className="mt-4 space-y-6">
          <QuickActions actions={[quickActions[0]]} />
          <JournalEntriesTab />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <FinancialReportsTab />
        </TabsContent>

        <TabsContent value="periods" className="mt-4">
          <AccountingPeriodsTab />
        </TabsContent>

        <TabsContent value="recurring" className="mt-4">
          <PlaceholderContent
            title="Recurring Journal Entries"
            description="Set up templates for journal entries that repeat on a schedule — monthly accruals, depreciation postings, and more."
          />
        </TabsContent>

        <TabsContent value="currencies" className="mt-4">
          <PlaceholderContent
            title="Multi-Currency Management"
            description="Configure exchange rates, revaluation rules, and foreign currency gain/loss accounts."
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <GLSettingsTab />
        </TabsContent>
      </ModuleSubTabs>

      <CreateJournalEntryWizard open={showJournalWizard} onOpenChange={setShowJournalWizard} />
    </>
  );
}
