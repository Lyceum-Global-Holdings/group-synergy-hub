import { useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { KPICard } from "../KPICard";
import { PlaceholderContent } from "../PlaceholderContent";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useFormatCurrency, useFormatDate } from "@/lib/formatters";
import { usePurchaseRequisitions } from "@/hooks/usePurchaseRequisitions";
import { usePurchaseOrders, usePoSummaryStats } from "@/hooks/usePurchaseOrders";
import { useGoodsReceiptNotes, useGrnSummary } from "@/hooks/useGoodsReceiptNotes";
import { useCompany } from "@/contexts/CompanyContext";
import { CreatePrDialog } from "@/components/procurement/CreatePrDialog";
import { CreatePoDialog } from "@/components/procurement/CreatePoDialog";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Plus, FileText, ShoppingCart, Package } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

interface ProcurementModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

const subTabs = [
  { id: "pr", label: "Purchase Requisitions" },
  { id: "po", label: "Purchase Orders" },
  { id: "grn", label: "Goods Receipt Notes" },
  { id: "matching", label: "Invoice Matching" },
];

export default function ProcurementModule({ activeSubTab, onSubTabChange }: ProcurementModuleProps) {
  const effectiveTab = activeSubTab || "pr";

  return (
    <ModuleSubTabs tabs={subTabs} activeTab={effectiveTab} onTabChange={onSubTabChange}>
      <TabsContent value="pr"><PRTab /></TabsContent>
      <TabsContent value="po"><POTab /></TabsContent>
      <TabsContent value="grn"><GRNTab /></TabsContent>
      <TabsContent value="matching">
        <PlaceholderContent
          title="Invoice Matching"
          description="3-way matching between Purchase Orders, Goods Receipt Notes, and Supplier Invoices. This feature is coming soon."
        />
      </TabsContent>
    </ModuleSubTabs>
  );
}

function PRTab() {
  const { data: prs = [], isLoading } = usePurchaseRequisitions();
  const [showCreate, setShowCreate] = useState(false);
  const formatDate = useFormatDate();
  const formatCurr = useFormatCurrency();

  const columns: ColumnDef<any>[] = [
    { accessorKey: "pr_number", header: "PR #" },
    { accessorKey: "title", header: "Title" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.getValue("status")} /> },
    { accessorKey: "total_estimated_cost", header: "Est. Cost", cell: ({ row }) => formatCurr(row.getValue("total_estimated_cost")) },
    { accessorKey: "required_date", header: "Required Date", cell: ({ row }) => formatDate(row.getValue("required_date")) },
    { accessorKey: "created_at", header: "Created", cell: ({ row }) => formatDate(row.getValue("created_at")) },
  ];

  const total = prs.length;
  const pending = prs.filter((p: any) => p.status === "pending" || p.status === "submitted").length;
  const approved = prs.filter((p: any) => p.status === "approved").length;

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total PRs" value={total} icon={FileText} />
        <KPICard label="Pending" value={pending} icon={FileText} variant="warning" />
        <KPICard label="Approved" value={approved} icon={FileText} variant="success" />
        <div className="flex items-end">
          <Button onClick={() => setShowCreate(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" /> New Requisition
          </Button>
        </div>
      </div>
      <DataTable columns={columns} data={prs} isLoading={isLoading} />
      <CreatePrDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}

function POTab() {
  const { data: pos = [], isLoading } = usePurchaseOrders();
  const { data: stats } = usePoSummaryStats();
  const [showCreate, setShowCreate] = useState(false);
  const formatDate = useFormatDate();
  const formatCurr = useFormatCurrency();

  const columns: ColumnDef<any>[] = [
    { accessorKey: "po_number", header: "PO #" },
    { accessorKey: "supplier_name", header: "Supplier" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.getValue("status")} /> },
    { accessorKey: "total_amount", header: "Total", cell: ({ row }) => formatCurr(row.getValue("total_amount")) },
    { accessorKey: "order_date", header: "Order Date", cell: ({ row }) => formatDate(row.getValue("order_date")) },
  ];

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total POs" value={stats?.total_pos || pos.length} icon={ShoppingCart} />
        <KPICard label="Pending" value={stats?.pending_approval_pos || 0} icon={ShoppingCart} variant="warning" />
        <KPICard label="Approved" value={stats?.approved_pos || 0} icon={ShoppingCart} variant="success" />
        <div className="flex items-end">
          <Button onClick={() => setShowCreate(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" /> New Order
          </Button>
        </div>
      </div>
      <DataTable columns={columns} data={pos} isLoading={isLoading} />
      <CreatePoDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}

function GRNTab() {
  const { selectedCompany } = useCompany();
  const { data: grns = [], isLoading } = useGoodsReceiptNotes(selectedCompany?.id);
  const { data: summary } = useGrnSummary(selectedCompany?.id);
  const formatDate = useFormatDate();

  const columns: ColumnDef<any>[] = [
    { accessorKey: "grn_number", header: "GRN #" },
    { accessorKey: "po_number", header: "PO #" },
    { accessorKey: "supplier_name", header: "Supplier" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.getValue("status")} /> },
    { accessorKey: "received_date", header: "Received", cell: ({ row }) => formatDate(row.getValue("received_date")) },
  ];

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total GRNs" value={summary?.total_grns || grns.length} icon={Package} />
        <KPICard label="Pending Approval" value={summary?.pending_approval || 0} icon={Package} variant="warning" />
        <KPICard label="Approved This Month" value={summary?.approved_this_month || 0} icon={Package} variant="success" />
        <KPICard label="Total Value" value={summary?.total_value?.toLocaleString() || "0"} icon={Package} variant="primary" />
      </div>
      <DataTable columns={columns} data={grns} isLoading={isLoading} />
    </div>
  );
}
