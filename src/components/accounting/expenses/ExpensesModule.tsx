import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { KPICard } from "../KPICard";
import { DataTable, DataTableColumn } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SupplierInvoiceList } from "@/components/finance/ap/SupplierInvoiceList";
import {
  useExpensesDashboard, usePettyCashFunds, usePettyCashFundStats,
  usePettyCashVouchers, usePettyCashVoucherStats, useStaffAdvances, useStaffAdvanceStats,
} from "@/hooks/finance/useExpenses";
import { useFormatCurrency, useFormatDate } from "@/lib/formatters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, Receipt, Wallet, CreditCard, TrendingUp,
  FileText, Clock, Users, Banknote, CheckCircle
} from "lucide-react";

interface ExpensesModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

const subTabs = [
  { id: "dashboard", label: "Dashboard" },
  { id: "all", label: "All Expenses" },
  { id: "bills", label: "Company Bills" },
  { id: "petty-funds", label: "Petty Cash Funds" },
  { id: "petty-vouchers", label: "Vouchers" },
  { id: "advances", label: "Staff Advances" },
];

export default function ExpensesModule({ activeSubTab, onSubTabChange }: ExpensesModuleProps) {
  return (
    <ModuleSubTabs tabs={subTabs} activeTab={activeSubTab || "dashboard"} onTabChange={onSubTabChange}>
      <TabsContent value="dashboard" className="mt-4"><ExpensesDashboard /></TabsContent>
      <TabsContent value="all" className="mt-4 space-y-6"><AllExpensesTab /></TabsContent>
      <TabsContent value="bills" className="mt-4 space-y-6"><SupplierInvoiceList /></TabsContent>
      <TabsContent value="petty-funds" className="mt-4 space-y-6"><PettyCashFundsTab /></TabsContent>
      <TabsContent value="petty-vouchers" className="mt-4 space-y-6"><PettyCashVouchersTab /></TabsContent>
      <TabsContent value="advances" className="mt-4 space-y-6"><StaffAdvancesTab /></TabsContent>
    </ModuleSubTabs>
  );
}

// ─── Dashboard ───
function ExpensesDashboard() {
  const { data: stats } = useExpensesDashboard();
  const formatCurrency = useFormatCurrency();

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total Expenses" value={formatCurrency(stats?.totalExpenses)} icon={DollarSign} />
        <KPICard label="Pending Approvals" value={stats?.pendingApprovals ?? 0} icon={Receipt} variant="warning" />
        <KPICard label="Petty Cash Balance" value={formatCurrency(stats?.pettyCashBalance)} icon={Wallet} variant="primary" />
        <KPICard label="Outstanding Advances" value={formatCurrency(stats?.outstandingAdvances)} icon={CreditCard} variant="destructive" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expenses by Category</CardTitle>
            <CardDescription>Monthly breakdown by expense type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <div className="text-center">
                <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Chart will appear when expense categories are configured</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Cost Centers</CardTitle>
            <CardDescription>Highest spending departments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <div className="text-center">
                <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Chart will appear when cost center data is available</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── All Expenses (AP invoices reused) ───
function AllExpensesTab() {
  const { data: stats } = useExpensesDashboard();
  const formatCurrency = useFormatCurrency();

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total Expenses" value={formatCurrency(stats?.totalExpenses)} icon={DollarSign} variant="primary" />
        <KPICard label="Pending Approvals" value={stats?.pendingApprovals ?? 0} icon={Clock} variant="warning" />
        <KPICard label="Petty Cash" value={formatCurrency(stats?.pettyCashBalance)} icon={Wallet} />
        <KPICard label="Advances Outstanding" value={formatCurrency(stats?.outstandingAdvances)} icon={CreditCard} variant="destructive" />
      </div>
      <SupplierInvoiceList />
    </>
  );
}

// ─── Petty Cash Funds Tab ───
function PettyCashFundsTab() {
  const { data: funds, isLoading } = usePettyCashFunds();
  const { data: stats } = usePettyCashFundStats();
  const formatCurrency = useFormatCurrency();

  const columns: DataTableColumn<any>[] = [
    { key: "fund_code", header: "Code", render: (r) => r.fund_code || "—" },
    { key: "fund_name", header: "Fund Name" },
    { key: "custodian_name", header: "Custodian", render: (r) => r.custodian_name || "—" },
    { key: "location", header: "Location", render: (r) => r.location || "—" },
    { key: "float_amount", header: "Float", render: (r) => formatCurrency(r.float_amount) },
    { key: "current_balance", header: "Balance", render: (r) => formatCurrency(r.current_balance) },
    { key: "utilization", header: "Utilization", render: (r) => {
      const used = Number(r.float_amount || 0) - Number(r.current_balance || 0);
      const pct = r.float_amount > 0 ? Math.round((used / r.float_amount) * 100) : 0;
      return <Badge variant={pct > 80 ? "destructive" : pct > 50 ? "secondary" : "default"}>{pct}%</Badge>;
    }},
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={Wallet} label="Total Funds" value={stats?.totalFunds ?? 0} variant="primary" />
        <KPICard icon={CheckCircle} label="Active Funds" value={stats?.activeFunds ?? 0} variant="success" />
        <KPICard icon={DollarSign} label="Total Float" value={formatCurrency(stats?.totalFloat)} />
        <KPICard icon={Banknote} label="Current Balance" value={formatCurrency(stats?.totalBalance)} variant="warning" />
      </div>
      <DataTable columns={columns} data={funds || []} isLoading={isLoading} emptyMessage="No petty cash funds configured" />
    </>
  );
}

// ─── Petty Cash Vouchers Tab ───
function PettyCashVouchersTab() {
  const { data: vouchers, isLoading } = usePettyCashVouchers();
  const { data: stats } = usePettyCashVoucherStats();
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();

  const columns: DataTableColumn<any>[] = [
    { key: "voucher_number", header: "Voucher #" },
    { key: "fund", header: "Fund", render: (r) => r.fund?.fund_name || "—" },
    { key: "voucher_date", header: "Date", render: (r) => formatDate(r.voucher_date) },
    { key: "payee_name", header: "Payee" },
    { key: "description", header: "Description", render: (r) => r.description || "—" },
    { key: "amount", header: "Amount", render: (r) => formatCurrency(r.amount) },
    { key: "receipt_attached", header: "Receipt", render: (r) => r.receipt_attached ? <Badge variant="default">Yes</Badge> : <Badge variant="secondary">No</Badge> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={Receipt} label="Total Vouchers" value={stats?.total ?? 0} variant="primary" />
        <KPICard icon={FileText} label="Draft" value={stats?.draft ?? 0} variant="warning" />
        <KPICard icon={CheckCircle} label="Approved" value={stats?.approved ?? 0} variant="success" />
        <KPICard icon={DollarSign} label="Total Amount" value={formatCurrency(stats?.totalAmount)} />
      </div>
      <DataTable columns={columns} data={vouchers || []} isLoading={isLoading} emptyMessage="No petty cash vouchers found" />
    </>
  );
}

// ─── Staff Advances Tab ───
function StaffAdvancesTab() {
  const { data: advances, isLoading } = useStaffAdvances();
  const { data: stats } = useStaffAdvanceStats();
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();

  const columns: DataTableColumn<any>[] = [
    { key: "advance_number", header: "Advance #" },
    { key: "employee_name", header: "Employee" },
    { key: "advance_date", header: "Date", render: (r) => formatDate(r.advance_date) },
    { key: "purpose", header: "Purpose", render: (r) => r.purpose || "—" },
    { key: "disbursed_amount", header: "Disbursed", render: (r) => formatCurrency(r.disbursed_amount) },
    { key: "settled_amount", header: "Settled", render: (r) => formatCurrency(r.settled_amount) },
    { key: "outstanding_amount", header: "Outstanding", render: (r) => formatCurrency(r.outstanding_amount) },
    { key: "settlement_due_date", header: "Due Date", render: (r) => r.settlement_due_date ? formatDate(r.settlement_due_date) : "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Total Advances" value={stats?.total ?? 0} variant="primary" />
        <KPICard icon={Clock} label="Pending" value={stats?.pending ?? 0} variant="warning" />
        <KPICard icon={DollarSign} label="Total Disbursed" value={formatCurrency(stats?.totalDisbursed)} />
        <KPICard icon={CreditCard} label="Outstanding" value={formatCurrency(stats?.totalOutstanding)} variant="destructive" />
      </div>
      <DataTable columns={columns} data={advances || []} isLoading={isLoading} emptyMessage="No staff advances found" />
    </>
  );
}
