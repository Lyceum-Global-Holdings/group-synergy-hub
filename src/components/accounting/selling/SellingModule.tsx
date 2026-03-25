import { useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { KPICard } from "../KPICard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useFormatCurrency, useFormatDate } from "@/lib/formatters";
import { usePickPack } from "@/hooks/usePickPack";
import { useDeliveryOrders } from "@/hooks/useDeliveryOrders";
import { useCompany } from "@/contexts/CompanyContext";
import { DataTable } from "@/components/ui/data-table";
import { ShoppingBag, Truck, ClipboardList } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

interface SellingModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

const subTabs = [
  { id: "orders", label: "Sales Orders" },
  { id: "delivery", label: "Delivery Notes" },
  { id: "picklists", label: "Pick Lists" },
];

export default function SellingModule({ activeSubTab, onSubTabChange }: SellingModuleProps) {
  const effectiveTab = activeSubTab || "orders";

  return (
    <ModuleSubTabs tabs={subTabs} activeTab={effectiveTab} onTabChange={onSubTabChange}>
      <TabsContent value="orders"><SalesOrdersTab /></TabsContent>
      <TabsContent value="delivery"><DeliveryNotesTab /></TabsContent>
      <TabsContent value="picklists"><PickListsTab /></TabsContent>
    </ModuleSubTabs>
  );
}

function SalesOrdersTab() {
  const { useSalesOrders } = usePickPack();
  const { data: salesOrders = [], isLoading } = useSalesOrders();
  const formatDate = useFormatDate();
  const formatCurr = useFormatCurrency();

  const columns: ColumnDef<any>[] = [
    { accessorKey: "order_number", header: "SO #" },
    { accessorKey: "customer_name", header: "Customer" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
    },
    {
      accessorKey: "total_amount",
      header: "Total",
      cell: ({ row }) => formatCurr(row.getValue("total_amount")),
    },
    {
      accessorKey: "order_date",
      header: "Order Date",
      cell: ({ row }) => formatDate(row.getValue("order_date")),
    },
  ];

  const total = salesOrders.length;
  const pending = salesOrders.filter((o: any) => o.status === "pending" || o.status === "confirmed").length;
  const completed = salesOrders.filter((o: any) => o.status === "completed" || o.status === "delivered").length;

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="Total Orders" value={total} icon={ShoppingBag} />
        <KPICard title="Pending" value={pending} icon={ShoppingBag} variant="warning" />
        <KPICard title="Completed" value={completed} icon={ShoppingBag} variant="success" />
      </div>
      <DataTable columns={columns} data={salesOrders} isLoading={isLoading} />
    </div>
  );
}

function DeliveryNotesTab() {
  const { selectedCompany } = useCompany();
  const { useDeliveryOrdersQuery } = useDeliveryOrders();
  const { data: deliveryOrders = [], isLoading } = useDeliveryOrdersQuery(selectedCompany?.id);
  const formatDate = useFormatDate();

  const columns: ColumnDef<any>[] = [
    { accessorKey: "delivery_number", header: "DN #" },
    { accessorKey: "sales_order_number", header: "SO #" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
    },
    {
      accessorKey: "delivery_date",
      header: "Delivery Date",
      cell: ({ row }) => formatDate(row.getValue("delivery_date")),
    },
  ];

  const total = deliveryOrders.length;
  const dispatched = deliveryOrders.filter((d: any) => d.status === "dispatched" || d.status === "delivered").length;

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="Total Deliveries" value={total} icon={Truck} />
        <KPICard title="Dispatched" value={dispatched} icon={Truck} variant="success" />
        <KPICard title="Pending" value={total - dispatched} icon={Truck} variant="warning" />
      </div>
      <DataTable columns={columns} data={deliveryOrders} isLoading={isLoading} />
    </div>
  );
}

function PickListsTab() {
  const { usePickLists } = usePickPack();
  const { data: pickLists = [], isLoading } = usePickLists();
  const formatDate = useFormatDate();

  const columns: ColumnDef<any>[] = [
    { accessorKey: "pick_list_number", header: "Pick List #" },
    { accessorKey: "sales_order_number", header: "SO #" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => formatDate(row.getValue("created_at")),
    },
  ];

  const total = pickLists.length;
  const inProgress = pickLists.filter((p: any) => p.status === "picking" || p.status === "in_progress").length;

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="Total Pick Lists" value={total} icon={ClipboardList} />
        <KPICard title="In Progress" value={inProgress} icon={ClipboardList} variant="warning" />
        <KPICard title="Completed" value={total - inProgress} icon={ClipboardList} variant="success" />
      </div>
      <DataTable columns={columns} data={pickLists} isLoading={isLoading} />
    </div>
  );
}
