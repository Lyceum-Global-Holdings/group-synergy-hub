import { useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { QuickActions } from "../QuickActions";
import { KPICard } from "../KPICard";
import { BankAccountList } from "@/components/finance/bank/BankAccountList";
import { BankTransactionList } from "@/components/finance/bank/BankTransactionList";
import { CashPositionDashboard } from "@/components/finance/bank/CashPositionDashboard";
import { CreateBankAccountDialog } from "@/components/finance/bank/CreateBankAccountDialog";
import { CreateBankTransactionDialog } from "@/components/finance/bank/CreateBankTransactionDialog";
import { DataTable, DataTableColumn } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  useBankingStats, useCheques, useChequeStats, useFundTransfers, useFundTransferStats,
  usePaymentBatches, usePaymentBatchStats, useTransactionRules,
} from "@/hooks/finance/useBankingExpansion";
import { useFormatCurrency, useFormatDate } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus, RefreshCw, Download, Landmark, BookOpen, FileCheck, ArrowLeftRight,
  Layers, Settings2, DollarSign, Clock, FileText, CreditCard
} from "lucide-react";

const subTabs = [
  { id: "accounts", label: "Bank Accounts" },
  { id: "transactions", label: "Transactions" },
  { id: "cashbook", label: "Cashbook" },
  { id: "cheques", label: "Cheque Register" },
  { id: "transfers", label: "Fund Transfers" },
  { id: "batches", label: "Payment Batches" },
  { id: "rules", label: "Transaction Rules" },
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

  return (
    <>
      <ModuleSubTabs tabs={subTabs} activeTab={activeSubTab || "accounts"} onTabChange={onSubTabChange}>
        <TabsContent value="accounts" className="mt-4 space-y-6">
          <QuickActions actions={[
            { label: "New Account", icon: Plus, onClick: () => setShowAccountDialog(true) },
            { label: "Export", icon: Download, onClick: () => {} },
          ]} />
          <BankAccountList />
        </TabsContent>

        <TabsContent value="transactions" className="mt-4 space-y-6">
          <QuickActions actions={[
            { label: "New Transaction", icon: Plus, onClick: () => setShowTransactionDialog(true) },
            { label: "Reconcile", icon: RefreshCw, onClick: () => onSubTabChange("reconciliation") },
            { label: "Export", icon: Download, onClick: () => {} },
          ]} />
          <BankTransactionList />
        </TabsContent>

        <TabsContent value="cashbook" className="mt-4 space-y-6">
          <CashbookTab />
        </TabsContent>

        <TabsContent value="cheques" className="mt-4 space-y-6">
          <ChequeRegisterTab />
        </TabsContent>

        <TabsContent value="transfers" className="mt-4 space-y-6">
          <FundTransfersTab />
        </TabsContent>

        <TabsContent value="batches" className="mt-4 space-y-6">
          <PaymentBatchesTab />
        </TabsContent>

        <TabsContent value="rules" className="mt-4 space-y-6">
          <TransactionRulesTab />
        </TabsContent>

        <TabsContent value="position" className="mt-4">
          <CashPositionDashboard />
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-4 space-y-6">
          <PlaceholderTab
            icon={RefreshCw}
            title="Bank Reconciliation"
            description="Select a bank account to start reconciliation. Import bank statements and match transactions against your book records to identify discrepancies."
          />
        </TabsContent>
      </ModuleSubTabs>

      <CreateBankAccountDialog open={showAccountDialog} onOpenChange={setShowAccountDialog} />
      <CreateBankTransactionDialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog} />
    </>
  );
}

// ─── Cashbook Tab ───
function CashbookTab() {
  const { data: stats } = useBankingStats();
  const formatCurrency = useFormatCurrency();

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={Landmark} label="Total Accounts" value={stats?.totalAccounts ?? 0} variant="primary" />
        <KPICard icon={Landmark} label="Active Accounts" value={stats?.activeAccounts ?? 0} variant="success" />
        <KPICard icon={DollarSign} label="Total Balance" value={formatCurrency(stats?.totalBalance)} />
        <KPICard icon={Clock} label="Unreconciled" value={stats?.unreconciledCount ?? 0} variant="warning" />
      </div>
      <PlaceholderTab
        icon={BookOpen}
        title="Cashbook View"
        description="View a consolidated cashbook showing all bank account transactions in a ledger format. Filter by account, date range, and transaction type for detailed cash flow analysis."
      />
    </>
  );
}

// ─── Cheque Register Tab ───
function ChequeRegisterTab() {
  const { data: cheques, isLoading } = useCheques();
  const { data: stats } = useChequeStats();
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();

  const columns: DataTableColumn<any>[] = [
    { key: "cheque_number", header: "Cheque #" },
    { key: "cheque_type", header: "Type", render: (r) => <Badge variant={r.cheque_type === "issued" ? "destructive" : "default"} className="capitalize">{r.cheque_type}</Badge> },
    { key: "cheque_date", header: "Date", render: (r) => formatDate(r.cheque_date) },
    { key: "payee_payer", header: "Payee/Payer" },
    { key: "bank_account", header: "Bank Account", render: (r) => r.bank_account?.account_name || "—" },
    { key: "amount", header: "Amount", render: (r) => formatCurrency(r.amount) },
    { key: "is_post_dated", header: "Post-Dated", render: (r) => r.is_post_dated ? "Yes" : "No" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={FileCheck} label="Total Cheques" value={stats?.total ?? 0} variant="primary" />
        <KPICard icon={FileText} label="Issued" value={stats?.issued ?? 0} variant="warning" />
        <KPICard icon={FileText} label="Received" value={stats?.received ?? 0} variant="success" />
        <KPICard icon={Clock} label="Post-Dated" value={stats?.postDated ?? 0} />
      </div>
      <DataTable columns={columns} data={cheques || []} isLoading={isLoading} emptyMessage="No cheques found" />
    </>
  );
}

// ─── Fund Transfers Tab ───
function FundTransfersTab() {
  const { data: transfers, isLoading } = useFundTransfers();
  const { data: stats } = useFundTransferStats();
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();

  const columns: DataTableColumn<any>[] = [
    { key: "reference_number", header: "Reference", render: (r) => r.reference_number || "—" },
    { key: "transfer_date", header: "Date", render: (r) => formatDate(r.transfer_date) },
    { key: "from_account", header: "From", render: (r) => r.from_account?.account_name || "—" },
    { key: "to_account", header: "To", render: (r) => r.to_account?.account_name || "—" },
    { key: "amount", header: "Amount", render: (r) => formatCurrency(r.amount) },
    { key: "description", header: "Description", render: (r) => r.description || "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={ArrowLeftRight} label="Total Transfers" value={stats?.total ?? 0} variant="primary" />
        <KPICard icon={DollarSign} label="Total Amount" value={formatCurrency(stats?.totalAmount)} />
        <KPICard icon={Clock} label="Pending" value={stats?.pending ?? 0} variant="warning" />
        <KPICard icon={FileCheck} label="Completed" value={stats?.completed ?? 0} variant="success" />
      </div>
      <DataTable columns={columns} data={transfers || []} isLoading={isLoading} emptyMessage="No fund transfers found" />
    </>
  );
}

// ─── Payment Batches Tab ───
function PaymentBatchesTab() {
  const { data: batches, isLoading } = usePaymentBatches();
  const { data: stats } = usePaymentBatchStats();
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();

  const columns: DataTableColumn<any>[] = [
    { key: "batch_number", header: "Batch #" },
    { key: "batch_date", header: "Date", render: (r) => formatDate(r.batch_date) },
    { key: "batch_type", header: "Type", render: (r) => <Badge className="capitalize">{r.batch_type}</Badge> },
    { key: "bank_account", header: "Bank Account", render: (r) => r.bank_account?.account_name || "—" },
    { key: "payment_count", header: "Payments", render: (r) => r.payment_count },
    { key: "total_amount", header: "Total Amount", render: (r) => formatCurrency(r.total_amount) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={Layers} label="Total Batches" value={stats?.total ?? 0} variant="primary" />
        <KPICard icon={CreditCard} label="Total Payments" value={stats?.totalPayments ?? 0} />
        <KPICard icon={DollarSign} label="Total Amount" value={formatCurrency(stats?.totalAmount)} variant="success" />
        <KPICard icon={FileText} label="Draft" value={stats?.draft ?? 0} variant="warning" />
      </div>
      <DataTable columns={columns} data={batches || []} isLoading={isLoading} emptyMessage="No payment batches found" />
    </>
  );
}

// ─── Transaction Rules Tab ───
function TransactionRulesTab() {
  const { data: rules, isLoading } = useTransactionRules();

  const columns: DataTableColumn<any>[] = [
    { key: "rule_name", header: "Rule Name" },
    { key: "match_pattern", header: "Pattern" },
    { key: "match_field", header: "Match Field", render: (r) => <Badge variant="outline" className="capitalize">{r.match_field}</Badge> },
    { key: "gl_account", header: "GL Account", render: (r) => r.gl_account?.account_name || "—" },
    { key: "description_template", header: "Description Template", render: (r) => r.description_template || "—" },
    { key: "priority", header: "Priority" },
    { key: "is_active", header: "Active", render: (r) => r.is_active ? <Badge variant="default">Active</Badge> : <Badge variant="secondary">Inactive</Badge> },
  ];

  return (
    <>
      <Card className="mb-4">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Transaction rules automatically categorize imported bank statement lines based on pattern matching.
            Rules are applied in priority order during statement import.
          </p>
        </CardContent>
      </Card>
      <DataTable columns={columns} data={rules || []} isLoading={isLoading} emptyMessage="No transaction rules configured" />
    </>
  );
}

// ─── Placeholder Tab ───
function PlaceholderTab({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5" /> {title}</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Icon className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-2">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
