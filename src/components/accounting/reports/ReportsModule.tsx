import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { QuickActions } from "../QuickActions";
import { ProfitLossReport } from "@/components/finance/reports/ProfitLossReport";
import { BalanceSheetReport } from "@/components/finance/reports/BalanceSheetReport";
import { CashFlowReport } from "@/components/finance/reports/CashFlowReport";
import { GeneralLedgerReport } from "@/components/finance/reports/GeneralLedgerReport";
import { TaxSummaryReport } from "@/components/finance/reports/TaxSummaryReport";
import { TrialBalanceReport } from "@/components/finance/TrialBalanceReport";
import { Download, Printer, FileText } from "lucide-react";

const subTabs = [
  { id: "profit-loss", label: "Profit & Loss" },
  { id: "balance-sheet", label: "Balance Sheet" },
  { id: "trial-balance", label: "Trial Balance" },
  { id: "cash-flow", label: "Cash Flow" },
  { id: "general-ledger", label: "General Ledger" },
  { id: "tax", label: "Tax Summary" },
];

interface ReportsModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function ReportsModule({ activeSubTab, onSubTabChange }: ReportsModuleProps) {
  const quickActions = [
    { label: "Generate Report", icon: FileText, onClick: () => {} },
    { label: "Export PDF", icon: Download, onClick: () => {} },
    { label: "Print", icon: Printer, onClick: () => window.print() },
  ];

  return (
    <ModuleSubTabs tabs={subTabs} activeTab={activeSubTab || "profit-loss"} onTabChange={onSubTabChange}>
      <TabsContent value="profit-loss" className="mt-4 space-y-6">
        <QuickActions actions={quickActions} />
        <ProfitLossReport />
      </TabsContent>

      <TabsContent value="balance-sheet" className="mt-4">
        <BalanceSheetReport />
      </TabsContent>

      <TabsContent value="trial-balance" className="mt-4">
        <TrialBalanceReport />
      </TabsContent>

      <TabsContent value="cash-flow" className="mt-4">
        <CashFlowReport />
      </TabsContent>

      <TabsContent value="general-ledger" className="mt-4">
        <GeneralLedgerReport />
      </TabsContent>

      <TabsContent value="tax" className="mt-4">
        <TaxSummaryReport />
      </TabsContent>
    </ModuleSubTabs>
  );
}