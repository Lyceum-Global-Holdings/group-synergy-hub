import { useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { QuickActions } from "../QuickActions";
import { BankAccountList } from "@/components/finance/bank/BankAccountList";
import { BankTransactionList } from "@/components/finance/bank/BankTransactionList";
import { CashPositionDashboard } from "@/components/finance/bank/CashPositionDashboard";
import { BankStatementImport } from "@/components/finance/bank/BankStatementImport";
import { CreateBankAccountDialog } from "@/components/finance/bank/CreateBankAccountDialog";
import { CreateBankTransactionDialog } from "@/components/finance/bank/CreateBankTransactionDialog";
import { Plus, RefreshCw, Download } from "lucide-react";

const subTabs = [
  { id: "accounts", label: "Bank Accounts" },
  { id: "transactions", label: "Transactions" },
  { id: "position", label: "Cash Position" },
  { id: "reconciliation", label: "Reconciliation" },
];

interface BankingModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function BankingModule({ activeSubTab, onSubTabChange }: BankingModuleProps) {
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);

  const quickActions = [
    { label: "New Account", icon: Plus, onClick: () => setShowAccountDialog(true) },
    { label: "New Transaction", icon: Plus, onClick: () => setShowTransactionDialog(true) },
    { label: "Reconcile", icon: RefreshCw, onClick: () => onSubTabChange("reconciliation") },
    { label: "Export", icon: Download, onClick: () => {} },
  ];

  return (
    <>
      <ModuleSubTabs tabs={subTabs} activeTab={activeSubTab || "accounts"} onTabChange={onSubTabChange}>
        <TabsContent value="accounts" className="mt-4 space-y-6">
          <QuickActions actions={[quickActions[0], quickActions[3]]} />
          <BankAccountList />
        </TabsContent>

        <TabsContent value="transactions" className="mt-4 space-y-6">
          <QuickActions actions={[quickActions[1], quickActions[2], quickActions[3]]} />
          <BankTransactionList />
        </TabsContent>

        <TabsContent value="position" className="mt-4">
          <CashPositionDashboard />
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-4">
          <BankStatementImport />
        </TabsContent>
      </ModuleSubTabs>

      <CreateBankAccountDialog open={showAccountDialog} onOpenChange={setShowAccountDialog} />
      <CreateBankTransactionDialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog} />
    </>
  );
}