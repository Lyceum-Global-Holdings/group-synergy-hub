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
import { Plus, FileDown, Calendar } from "lucide-react";

const subTabs = [
  { id: "chart-of-accounts", label: "Chart of Accounts" },
  { id: "journal-entries", label: "Journal Entries" },
  { id: "reports", label: "Reports" },
  { id: "periods", label: "Periods" },
  { id: "settings", label: "Settings" },
];

interface GLModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function GLModule({ activeSubTab, onSubTabChange }: GLModuleProps) {
  const [showJournalWizard, setShowJournalWizard] = useState(false);

  const quickActions = [
    { label: "New Journal Entry", icon: Plus, onClick: () => setShowJournalWizard(true) },
    { label: "Export", icon: FileDown, onClick: () => {} },
    { label: "Period Closing", icon: Calendar, onClick: () => onSubTabChange("periods") },
  ];

  return (
    <>
      <ModuleSubTabs tabs={subTabs} activeTab={activeSubTab || "chart-of-accounts"} onTabChange={onSubTabChange}>
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

        <TabsContent value="settings" className="mt-4">
          <GLSettingsTab />
        </TabsContent>
      </ModuleSubTabs>

      <CreateJournalEntryWizard open={showJournalWizard} onOpenChange={setShowJournalWizard} />
    </>
  );
}