import { useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { QuickActions } from "../QuickActions";
import { KPICard } from "../KPICard";
import { CustomerList } from "@/components/finance/ar/CustomerList";
import { CustomerInvoiceList } from "@/components/finance/ar/CustomerInvoiceList";
import { CustomerReceiptList } from "@/components/finance/ar/CustomerReceiptList";
import { ARAgingReport } from "@/components/finance/ar/ARAgingReport";
import { CreateCustomerDialog } from "@/components/finance/ar/CreateCustomerDialog";
import { CreateCustomerInvoiceDialog } from "@/components/finance/ar/CreateCustomerInvoiceDialog";
import { RecordMoneyDialog } from "@/components/finance/RecordMoneyDialog";
import { DataTable, DataTableColumn } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useARStats, useCreditNotes, useCreditNoteStats, useCustomerAdvances, useCustomerAdvanceStats, useBadDebtProvisions, useBadDebtStats } from "@/hooks/finance/useARExpansion";
import { useFormatCurrency, useFormatDate } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus, Download, Users, FileText, DollarSign, Clock, Receipt,
  ArrowLeftRight, AlertTriangle, CalendarClock, Bell, BarChart3
} from "lucide-react";

const subTabs = [
  { id: "customers", label: "Customers" },
  { id: "invoices", label: "Invoices" },
  { id: "receipts", label: "Receipts" },
  { id: "credit-notes", label: "Credit Notes" },
  { id: "advances", label: "Advances" },
  { id: "recurring", label: "Recurring" },
  { id: "reminders", label: "Reminders" },
  { id: "bad-debt", label: "Bad Debt" },
  { id: "reconciliation", label: "Reconciliation" },
  { id: "aging", label: "Aging Report" },
  { id: "performance", label: "Performance" },
];

interface ARModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function ARModule({ activeSubTab, onSubTabChange }: ARModuleProps) {
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);

  return (
    <>
      <ModuleSubTabs tabs={subTabs} activeTab={activeSubTab || "customers"} onTabChange={onSubTabChange}>
        <TabsContent value="customers" className="mt-4 space-y-6">
          <QuickActions actions={[
            { label: "New Customer", icon: Plus, onClick: () => setShowCustomerDialog(true) },
            { label: "Export", icon: Download, onClick: () => {} },
          ]} />
          <CustomerList />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 space-y-6">
          <QuickActions actions={[
            { label: "New Invoice", icon: Plus, onClick: () => setShowInvoiceDialog(true) },
            { label: "Export", icon: Download, onClick: () => {} },
          ]} />
          <CustomerInvoiceList />
        </TabsContent>

        <TabsContent value="receipts" className="mt-4 space-y-6">
          <QuickActions actions={[
            { label: "Record Receipt", icon: Plus, onClick: () => setShowReceiptDialog(true) },
            { label: "Export", icon: Download, onClick: () => {} },
          ]} />
          <CustomerReceiptList />
        </TabsContent>

        <TabsContent value="credit-notes" className="mt-4 space-y-6">
          <CreditNotesTab />
        </TabsContent>

        <TabsContent value="advances" className="mt-4 space-y-6">
          <CustomerAdvancesTab />
        </TabsContent>

        <TabsContent value="recurring" className="mt-4 space-y-6">
          <PlaceholderTab
            icon={CalendarClock}
            title="Recurring Invoices"
            description="Set up recurring invoice schedules for customers with regular billing cycles. Automate invoice generation based on configurable frequencies."
          />
        </TabsContent>

        <TabsContent value="reminders" className="mt-4 space-y-6">
          <PlaceholderTab
            icon={Bell}
            title="Payment Reminders"
            description="Configure automated payment reminder workflows. Set up reminder schedules based on invoice aging and send notifications to customers with overdue balances."
          />
        </TabsContent>

        <TabsContent value="bad-debt" className="mt-4 space-y-6">
          <BadDebtTab />
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-4 space-y-6">
          <PlaceholderTab
            icon={ArrowLeftRight}
            title="AR Reconciliation"
            description="Reconcile customer statements against your receivable records. Match customer payments and invoices to identify discrepancies and outstanding items."
          />
        </TabsContent>

        <TabsContent value="aging" className="mt-4">
          <ARAgingReport />
        </TabsContent>

        <TabsContent value="performance" className="mt-4 space-y-6">
          <PerformanceTab />
        </TabsContent>
      </ModuleSubTabs>

      <CreateCustomerDialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog} />
      <CreateCustomerInvoiceDialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog} />
      <RecordMoneyDialog kind="receipt" open={showReceiptDialog} onOpenChange={setShowReceiptDialog} />
    </>
  );
}

// ─── Credit Notes Tab ───
function CreditNotesTab() {
  const { data: notes, isLoading } = useCreditNotes();
  const { data: stats } = useCreditNoteStats();
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();

  const columns: DataTableColumn<any>[] = [
    { key: "credit_note_number", header: "Credit Note #" },
    { key: "customer", header: "Customer", render: (r) => r.customer?.customer_name || "—" },
    { key: "credit_date", header: "Date", render: (r) => formatDate(r.credit_date) },
    { key: "amount", header: "Amount", render: (r) => formatCurrency(r.amount) },
    { key: "amount_applied", header: "Applied", render: (r) => formatCurrency(r.amount_applied) },
    { key: "reason", header: "Reason", render: (r) => r.reason || "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={Receipt} label="Total Credit Notes" value={stats?.total ?? 0} variant="primary" />
        <KPICard icon={FileText} label="Draft" value={stats?.draft ?? 0} variant="warning" />
        <KPICard icon={FileText} label="Applied" value={stats?.applied ?? 0} variant="success" />
        <KPICard icon={DollarSign} label="Unapplied" value={formatCurrency(stats?.unapplied)} variant="destructive" />
      </div>
      <DataTable columns={columns} data={notes || []} isLoading={isLoading} emptyMessage="No credit notes found" />
    </>
  );
}

// ─── Customer Advances Tab ───
function CustomerAdvancesTab() {
  const { data: advances, isLoading } = useCustomerAdvances();
  const { data: stats } = useCustomerAdvanceStats();
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();

  const columns: DataTableColumn<any>[] = [
    { key: "advance_number", header: "Advance #" },
    { key: "customer", header: "Customer", render: (r) => r.customer?.customer_name || "—" },
    { key: "advance_date", header: "Date", render: (r) => formatDate(r.advance_date) },
    { key: "original_amount", header: "Amount", render: (r) => formatCurrency(r.original_amount) },
    { key: "remaining_amount", header: "Remaining", render: (r) => formatCurrency(r.remaining_amount) },
    { key: "payment_method", header: "Method", render: (r) => r.payment_method || "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={ArrowLeftRight} label="Total Advances" value={stats?.total ?? 0} variant="primary" />
        <KPICard icon={DollarSign} label="Total Received" value={formatCurrency(stats?.totalReceived)} variant="success" />
        <KPICard icon={DollarSign} label="Outstanding" value={formatCurrency(stats?.outstanding)} variant="warning" />
        <KPICard icon={FileText} label="Fully Applied" value={stats?.fullyApplied ?? 0} />
      </div>
      <DataTable columns={columns} data={advances || []} isLoading={isLoading} emptyMessage="No customer advances found" />
    </>
  );
}

// ─── Bad Debt Tab ───
function BadDebtTab() {
  const { data: provisions, isLoading } = useBadDebtProvisions();
  const { data: stats } = useBadDebtStats();
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();

  const columns: DataTableColumn<any>[] = [
    { key: "customer", header: "Customer", render: (r) => r.customer?.customer_name || "—" },
    { key: "provision_date", header: "Provision Date", render: (r) => formatDate(r.provision_date) },
    { key: "amount", header: "Amount", render: (r) => formatCurrency(r.amount) },
    { key: "recovery_amount", header: "Recovered", render: (r) => formatCurrency(r.recovery_amount) },
    { key: "reason", header: "Reason", render: (r) => r.reason || "—" },
    { key: "write_off_date", header: "Write-off Date", render: (r) => r.write_off_date ? formatDate(r.write_off_date) : "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={AlertTriangle} label="Total Provisions" value={stats?.total ?? 0} variant="primary" />
        <KPICard icon={DollarSign} label="Provisioned" value={formatCurrency(stats?.totalProvisioned)} variant="destructive" />
        <KPICard icon={DollarSign} label="Recovered" value={formatCurrency(stats?.totalRecovered)} variant="success" />
        <KPICard icon={FileText} label="Written Off" value={stats?.writtenOff ?? 0} variant="warning" />
      </div>
      <DataTable columns={columns} data={provisions || []} isLoading={isLoading} emptyMessage="No bad debt provisions found" />
    </>
  );
}

// ─── Performance Tab ───
function PerformanceTab() {
  const { data: arStats } = useARStats();
  const formatCurrency = useFormatCurrency();

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Total Customers" value={arStats?.totalCustomers ?? 0} variant="primary" />
        <KPICard icon={BarChart3} label="Active Customers" value={arStats?.activeCustomers ?? 0} variant="success" />
        <KPICard icon={DollarSign} label="Total Received" value={formatCurrency(arStats?.totalReceived)} />
        <KPICard icon={DollarSign} label="Outstanding" value={formatCurrency(arStats?.outstandingAmount)} variant="warning" />
      </div>
      <PlaceholderTab
        icon={BarChart3}
        title="Customer Performance Analytics"
        description="Track customer payment behavior, average collection periods, and revenue trends. Identify top customers and those requiring attention."
      />
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
