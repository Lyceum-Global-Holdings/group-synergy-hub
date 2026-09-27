import { useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { QuickActions } from "../QuickActions";
import { KPICard } from "../KPICard";
import { SupplierInvoiceList } from "@/components/finance/ap/SupplierInvoiceList";
import { SupplierPaymentList } from "@/components/finance/ap/SupplierPaymentList";
import { APAgingReport } from "@/components/finance/ap/APAgingReport";
import { CreateSupplierInvoiceDialog } from "@/components/finance/ap/CreateSupplierInvoiceDialog";
import { CreatePaymentDialog } from "@/components/finance/ap/CreatePaymentDialog";
import { DataTable, DataTableColumn } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAPStats, useDebitNotes, useDebitNoteStats, useVendorAdvances, useVendorAdvanceStats, useWHTCertificates, useWHTStats } from "@/hooks/finance/useAPExpansion";
import { useFormatCurrency, useFormatDate } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus, CreditCard, Download, Users, FileText, Clock, DollarSign,
  Receipt, ArrowLeftRight, ShieldCheck, BarChart3, CalendarClock, Search
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

const subTabs = [
  { id: "invoices", label: "Invoices" },
  { id: "payments", label: "Payments" },
  { id: "vendors", label: "Vendors" },
  { id: "payment-center", label: "Payment Center" },
  { id: "debit-notes", label: "Debit Notes" },
  { id: "advances", label: "Advances" },
  { id: "wht", label: "WHT" },
  { id: "scheduled", label: "Scheduled" },
  { id: "reconciliation", label: "Reconciliation" },
  { id: "aging", label: "Aging Report" },
  { id: "performance", label: "Performance" },
];

interface APModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function APModule({ activeSubTab, onSubTabChange }: APModuleProps) {
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();

  return (
    <>
      <ModuleSubTabs tabs={subTabs} activeTab={activeSubTab || "invoices"} onTabChange={onSubTabChange}>
        <TabsContent value="invoices" className="mt-4 space-y-6">
          <QuickActions actions={[
            { label: "New Invoice", icon: Plus, onClick: () => setShowInvoiceDialog(true) },
            { label: "Export", icon: Download, onClick: () => {} },
          ]} />
          <SupplierInvoiceList />
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-6">
          <QuickActions actions={[
            { label: "New Payment", icon: CreditCard, onClick: () => setShowPaymentDialog(true) },
            { label: "Export", icon: Download, onClick: () => {} },
          ]} />
          <SupplierPaymentList />
        </TabsContent>

        <TabsContent value="vendors" className="mt-4 space-y-6">
          <VendorsTab />
        </TabsContent>

        <TabsContent value="payment-center" className="mt-4 space-y-6">
          <PaymentCenterTab />
        </TabsContent>

        <TabsContent value="debit-notes" className="mt-4 space-y-6">
          <DebitNotesTab />
        </TabsContent>

        <TabsContent value="advances" className="mt-4 space-y-6">
          <VendorAdvancesTab />
        </TabsContent>

        <TabsContent value="wht" className="mt-4 space-y-6">
          <WHTTab />
        </TabsContent>

        <TabsContent value="scheduled" className="mt-4 space-y-6">
          <ScheduledPaymentsTab />
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-4 space-y-6">
          <APReconciliationTab />
        </TabsContent>

        <TabsContent value="aging" className="mt-4">
          <APAgingReport />
        </TabsContent>

        <TabsContent value="performance" className="mt-4 space-y-6">
          <VendorPerformanceTab />
        </TabsContent>
      </ModuleSubTabs>

      <CreateSupplierInvoiceDialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog} />
      <CreatePaymentDialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog} />
    </>
  );
}

// ─── Vendors Tab ───
function VendorsTab() {
  const { selectedCompany } = useCompany();
  const { data: apStats } = useAPStats();
  const formatCurrency = useFormatCurrency();

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["ap-suppliers", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, supplier_code, status, payment_terms, email, phone, created_at")
        .eq("company_id", selectedCompany!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  const columns: DataTableColumn<any>[] = [
    { key: "supplier_code", header: "Code" },
    { key: "name", header: "Supplier Name" },
    { key: "email", header: "Email", render: (r) => r.email || "—" },
    { key: "phone", header: "Phone", render: (r) => r.phone || "—" },
    { key: "payment_terms", header: "Payment Terms", render: (r) => r.payment_terms || "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Total Vendors" value={apStats?.totalSuppliers ?? 0} variant="primary" />
        <KPICard icon={Users} label="Active Vendors" value={apStats?.activeSuppliers ?? 0} variant="success" />
        <KPICard icon={FileText} label="Total Invoices" value={apStats?.totalInvoices ?? 0} />
        <KPICard icon={DollarSign} label="Outstanding" value={formatCurrency(apStats?.outstandingAmount)} variant="warning" />
      </div>
      <DataTable columns={columns} data={suppliers || []} isLoading={isLoading} emptyMessage="No vendors found" />
    </>
  );
}

// ─── Payment Center Tab ───
function PaymentCenterTab() {
  const { data: apStats } = useAPStats();
  const formatCurrency = useFormatCurrency();

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={DollarSign} label="Total Outstanding" value={formatCurrency(apStats?.outstandingAmount)} variant="warning" />
        <KPICard icon={CreditCard} label="Payments Made" value={apStats?.totalPayments ?? 0} variant="success" />
        <KPICard icon={DollarSign} label="Total Paid" value={formatCurrency(apStats?.totalPaid)} variant="primary" />
        <KPICard icon={Clock} label="Pending Invoices" value={apStats?.totalInvoices ?? 0} />
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Due for Payment</CardTitle></CardHeader>
        <CardContent>
          <DueInvoicesTable />
        </CardContent>
      </Card>
    </>
  );
}

function DueInvoicesTable() {
  const { selectedCompany } = useCompany();
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();

  const { data, isLoading } = useQuery({
    queryKey: ["due-invoices", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_invoices")
        .select("*, supplier:suppliers(name)")
        .eq("company_id", selectedCompany!.id)
        .not("status", "in", '("paid","cancelled")')
        .order("due_date", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  const columns: DataTableColumn<any>[] = [
    { key: "invoice_number", header: "Invoice #" },
    { key: "supplier", header: "Supplier", render: (r) => r.supplier?.name || "—" },
    { key: "due_date", header: "Due Date", render: (r) => formatDate(r.due_date) },
    { key: "gross_amount", header: "Amount", render: (r) => formatCurrency(r.gross_amount) },
    { key: "amount_paid", header: "Paid", render: (r) => formatCurrency(r.amount_paid) },
    { key: "balance", header: "Balance", render: (r) => formatCurrency((r.gross_amount || 0) - (r.amount_paid || 0)) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return <DataTable columns={columns} data={data || []} isLoading={isLoading} emptyMessage="No invoices due" />;
}

// ─── Debit Notes Tab ───
function DebitNotesTab() {
  const { data: notes, isLoading } = useDebitNotes();
  const { data: stats } = useDebitNoteStats();
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();

  const columns: DataTableColumn<any>[] = [
    { key: "debit_note_number", header: "Debit Note #" },
    { key: "supplier", header: "Supplier", render: (r) => r.supplier?.name || "—" },
    { key: "debit_date", header: "Date", render: (r) => formatDate(r.debit_date) },
    { key: "amount", header: "Amount", render: (r) => formatCurrency(r.amount) },
    { key: "amount_applied", header: "Applied", render: (r) => formatCurrency(r.amount_applied) },
    { key: "reason", header: "Reason", render: (r) => r.reason || "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={Receipt} label="Total Debit Notes" value={stats?.total ?? 0} variant="primary" />
        <KPICard icon={FileText} label="Draft" value={stats?.draft ?? 0} variant="warning" />
        <KPICard icon={FileText} label="Applied" value={stats?.applied ?? 0} variant="success" />
        <KPICard icon={DollarSign} label="Total Amount" value={formatCurrency(stats?.totalAmount)} />
      </div>
      <DataTable columns={columns} data={notes || []} isLoading={isLoading} emptyMessage="No debit notes found" />
    </>
  );
}

// ─── Vendor Advances Tab ───
function VendorAdvancesTab() {
  const { data: advances, isLoading } = useVendorAdvances();
  const { data: stats } = useVendorAdvanceStats();
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();

  const columns: DataTableColumn<any>[] = [
    { key: "advance_number", header: "Advance #" },
    { key: "supplier", header: "Supplier", render: (r) => r.supplier?.name || "—" },
    { key: "advance_date", header: "Date", render: (r) => formatDate(r.advance_date) },
    { key: "amount", header: "Amount", render: (r) => formatCurrency(r.amount) },
    { key: "remaining_amount", header: "Remaining", render: (r) => formatCurrency(r.remaining_amount) },
    { key: "payment_method", header: "Method", render: (r) => r.payment_method || "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={ArrowLeftRight} label="Total Advances" value={stats?.total ?? 0} variant="primary" />
        <KPICard icon={Clock} label="Pending" value={stats?.pending ?? 0} variant="warning" />
        <KPICard icon={DollarSign} label="Total Advanced" value={formatCurrency(stats?.totalAdvanced)} />
        <KPICard icon={DollarSign} label="Outstanding" value={formatCurrency(stats?.outstanding)} variant="destructive" />
      </div>
      <DataTable columns={columns} data={advances || []} isLoading={isLoading} emptyMessage="No vendor advances found" />
    </>
  );
}

// ─── WHT Tab ───
function WHTTab() {
  const { data: certs, isLoading } = useWHTCertificates();
  const { data: stats } = useWHTStats();
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();

  const columns: DataTableColumn<any>[] = [
    { key: "certificate_number", header: "Certificate #" },
    { key: "supplier", header: "Supplier", render: (r) => r.supplier?.name || "—" },
    { key: "certificate_date", header: "Date", render: (r) => formatDate(r.certificate_date) },
    { key: "tax_period", header: "Tax Period", render: (r) => r.tax_period || "—" },
    { key: "gross_amount", header: "Gross", render: (r) => formatCurrency(r.gross_amount) },
    { key: "wht_amount", header: "WHT Amount", render: (r) => formatCurrency(r.wht_amount) },
    { key: "net_amount", header: "Net", render: (r) => formatCurrency(r.net_amount) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard icon={ShieldCheck} label="Total Certificates" value={stats?.total ?? 0} variant="primary" />
        <KPICard icon={FileText} label="Draft" value={stats?.draft ?? 0} variant="warning" />
        <KPICard icon={DollarSign} label="Total WHT" value={formatCurrency(stats?.totalWHT)} variant="destructive" />
      </div>
      <DataTable columns={columns} data={certs || []} isLoading={isLoading} emptyMessage="No WHT certificates found" />
    </>
  );
}

// ─── Scheduled Payments Tab ───
function ScheduledPaymentsTab() {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Scheduled Payments</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarClock className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Scheduled Payments</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-2">
            Set up recurring and scheduled payment runs for regular vendor obligations.
            Configure payment schedules based on invoice due dates and vendor terms.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── AP Reconciliation Tab ───
function APReconciliationTab() {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5" /> AP Reconciliation</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ArrowLeftRight className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Vendor Statement Reconciliation</h3>
          <p className="text-sm text-muted-foreground max-w-md mt-2">
            Reconcile vendor statements against your payable records. Match supplier invoices
            and payments to identify discrepancies and outstanding items.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Vendor Performance Tab ───
function VendorPerformanceTab() {
  const { data: apStats } = useAPStats();
  const formatCurrency = useFormatCurrency();

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Total Vendors" value={apStats?.totalSuppliers ?? 0} variant="primary" />
        <KPICard icon={BarChart3} label="Active Vendors" value={apStats?.activeSuppliers ?? 0} variant="success" />
        <KPICard icon={DollarSign} label="Total Paid" value={formatCurrency(apStats?.totalPaid)} />
        <KPICard icon={CreditCard} label="Payment Count" value={apStats?.totalPayments ?? 0} />
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Vendor Performance Analytics</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground">Performance Dashboard</h3>
            <p className="text-sm text-muted-foreground max-w-md mt-2">
              Track vendor delivery performance, payment history, and compliance metrics.
              Analyze spend patterns and identify optimization opportunities.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
