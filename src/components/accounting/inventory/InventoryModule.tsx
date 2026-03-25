import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { KPICard } from "../KPICard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useFormatCurrency, useFormatDate } from "@/lib/formatters";
import { useWarehouseItems } from "@/hooks/useWarehouseItems";
import { useWarehouseBinAllocations } from "@/hooks/useWarehouseBinAllocations";
import { useInventoryValuation } from "@/hooks/useInventoryValuation";
import { useStockAudit } from "@/hooks/useStockAudit";
import { DataTable } from "@/components/ui/data-table";
import { Package, Layers, Clock, RefreshCw } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

interface InventoryModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

const subTabs = [
  { id: "items", label: "Items" },
  { id: "stock", label: "Stock Levels" },
  { id: "batch", label: "Batch Tracking" },
  { id: "ageing", label: "Inventory Ageing" },
  { id: "reconciliation", label: "Stock Reconciliation" },
];

export default function InventoryModule({ activeSubTab, onSubTabChange }: InventoryModuleProps) {
  const effectiveTab = activeSubTab || "items";

  return (
    <ModuleSubTabs tabs={subTabs} activeTab={effectiveTab} onTabChange={onSubTabChange}>
      <TabsContent value="items"><ItemsTab /></TabsContent>
      <TabsContent value="stock"><StockLevelsTab /></TabsContent>
      <TabsContent value="batch"><BatchTrackingTab /></TabsContent>
      <TabsContent value="ageing"><AgeingTab /></TabsContent>
      <TabsContent value="reconciliation"><ReconciliationTab /></TabsContent>
    </ModuleSubTabs>
  );
}

function ItemsTab() {
  const { items = [], isLoading } = useWarehouseItems();
  const formatCurr = useFormatCurrency();

  const columns: ColumnDef<any>[] = [
    { accessorKey: "item_code", header: "Item Code" },
    { accessorKey: "item_name", header: "Name" },
    { accessorKey: "category_name", header: "Category" },
    {
      accessorKey: "current_stock",
      header: "Stock",
      cell: ({ row }) => (
        <span className={row.getValue("current_stock") as number <= (row.original.reorder_level || 0) ? "text-destructive font-medium" : ""}>
          {row.getValue("current_stock")} {row.original.unit_of_measure}
        </span>
      ),
    },
    { accessorKey: "unit_cost", header: "Unit Cost", cell: ({ row }) => formatCurr(row.getValue("unit_cost")) },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.getValue("status") || "active"} /> },
  ];

  const totalItems = items.length;
  const lowStock = items.filter((i: any) => i.current_stock <= (i.reorder_level || 0) && i.current_stock > 0).length;
  const outOfStock = items.filter((i: any) => i.current_stock === 0).length;

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total Items" value={totalItems} icon={Package} />
        <KPICard label="Low Stock" value={lowStock} icon={Package} variant="warning" />
        <KPICard label="Out of Stock" value={outOfStock} icon={Package} variant="destructive" />
        <KPICard label="Active" value={totalItems - outOfStock} icon={Package} variant="success" />
      </div>
      <DataTable columns={columns} data={items} isLoading={isLoading} />
    </div>
  );
}

function StockLevelsTab() {
  const { binAllocations = [], isLoading } = useWarehouseBinAllocations();

  const columns: ColumnDef<any>[] = [
    { accessorKey: "item_name", header: "Item" },
    { accessorKey: "item_code", header: "Code" },
    { accessorKey: "bin_code", header: "Bin" },
    { accessorKey: "location_name", header: "Location" },
    { accessorKey: "allocated_quantity", header: "Qty" },
  ];

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard label="Allocations" value={binAllocations.length} icon={Layers} />
        <KPICard label="Total Qty" value={binAllocations.reduce((s: number, a: any) => s + (a.allocated_quantity || 0), 0)} icon={Layers} variant="primary" />
        <KPICard label="Locations" value={new Set(binAllocations.map((a: any) => a.location_name)).size} icon={Layers} variant="success" />
      </div>
      <DataTable columns={columns} data={binAllocations} isLoading={isLoading} />
    </div>
  );
}

function BatchTrackingTab() {
  const { items = [], isLoading } = useWarehouseItems();
  const batchItems = items.filter((i: any) => i.is_batch_tracked);

  const columns: ColumnDef<any>[] = [
    { accessorKey: "item_code", header: "Item Code" },
    { accessorKey: "item_name", header: "Name" },
    { accessorKey: "category_name", header: "Category" },
    { accessorKey: "current_stock", header: "Stock", cell: ({ row }) => `${row.getValue("current_stock")} ${row.original.unit_of_measure || ""}` },
  ];

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard label="Batch-Tracked Items" value={batchItems.length} icon={Layers} />
      </div>
      <DataTable columns={columns} data={batchItems} isLoading={isLoading} />
    </div>
  );
}

function AgeingTab() {
  const { summary, valuationData = [], isLoading } = useInventoryValuation();
  const formatCurr = useFormatCurrency();

  const aging = summary?.aging_breakdown || {};
  const agingEntries = Object.entries(aging).map(([bucket, value]) => ({
    bucket,
    value: value as number,
  }));

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {agingEntries.map(({ bucket, value }) => (
          <KPICard
            key={bucket}
            label={bucket}
            value={formatCurr(value)}
            icon={Clock}
            variant={bucket.includes("90") || bucket.includes("180") ? "destructive" : "default"}
          />
        ))}
        {agingEntries.length === 0 && (
          <KPICard label="No Ageing Data" value="—" icon={Clock} />
        )}
      </div>
      <DataTable
        columns={[
          { accessorKey: "item_code", header: "Item Code" },
          { accessorKey: "item_name", header: "Name" },
          { accessorKey: "quantity", header: "Qty" },
          { accessorKey: "total_value", header: "Value", cell: ({ row }) => formatCurr(row.getValue("total_value")) },
          { accessorKey: "days_in_stock", header: "Days in Stock" },
        ] as ColumnDef<any>[]}
        data={valuationData}
        isLoading={isLoading}
      />
    </div>
  );
}

function ReconciliationTab() {
  const { auditItems = [], isLoading } = useStockAudit();

  const columns: ColumnDef<any>[] = [
    { accessorKey: "item_code", header: "Item Code" },
    { accessorKey: "item_name", header: "Name" },
    { accessorKey: "system_stock", header: "System Stock" },
    { accessorKey: "bin_total", header: "Bin Total" },
    {
      accessorKey: "variance",
      header: "Variance",
      cell: ({ row }) => {
        const v = row.getValue("variance") as number;
        return <span className={v !== 0 ? "text-destructive font-medium" : "text-green-600"}>{v}</span>;
      },
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.getValue("status") || "ok"} /> },
  ];

  const matched = auditItems.filter((i: any) => (i.variance || 0) === 0).length;
  const mismatched = auditItems.filter((i: any) => (i.variance || 0) !== 0).length;

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total Items" value={auditItems.length} icon={RefreshCw} />
        <KPICard label="Matched" value={matched} icon={RefreshCw} variant="success" />
        <KPICard label="Mismatched" value={mismatched} icon={RefreshCw} variant="destructive" />
        <KPICard label="Accuracy" value={auditItems.length ? `${Math.round((matched / auditItems.length) * 100)}%` : "—"} icon={RefreshCw} variant="primary" />
      </div>
      <DataTable columns={columns} data={auditItems} isLoading={isLoading} />
    </div>
  );
}
