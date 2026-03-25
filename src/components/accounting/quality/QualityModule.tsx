import { useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { KPICard } from "../KPICard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useFormatDate } from "@/lib/formatters";
import { useQualityInspections } from "@/hooks/construction/useQualityInspections";
import { DataTable } from "@/components/ui/data-table";
import { PlaceholderContent } from "../PlaceholderContent";
import { ClipboardCheck, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

interface QualityModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

const subTabs = [
  { id: "inspections", label: "Quality Inspections" },
  { id: "templates", label: "Inspection Templates" },
];

export default function QualityModule({ activeSubTab, onSubTabChange }: QualityModuleProps) {
  const effectiveTab = activeSubTab || "inspections";

  return (
    <ModuleSubTabs tabs={subTabs} activeTab={effectiveTab} onTabChange={onSubTabChange}>
      <TabsContent value="inspections"><InspectionsTab /></TabsContent>
      <TabsContent value="templates">
        <PlaceholderContent
          title="Inspection Templates"
          description="Define reusable inspection checklists and templates for quality control processes. This feature is coming soon."
        />
      </TabsContent>
    </ModuleSubTabs>
  );
}

function InspectionsTab() {
  const { data: inspections = [], isLoading } = useQualityInspections();
  const formatDate = useFormatDate();

  const columns: ColumnDef<any>[] = [
    { accessorKey: "inspection_number", header: "Inspection #" },
    { accessorKey: "inspection_type", header: "Type" },
    { accessorKey: "item_description", header: "Item / Area" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
    },
    {
      accessorKey: "result",
      header: "Result",
      cell: ({ row }) => {
        const result = row.getValue("result") as string;
        if (!result) return "—";
        return <StatusBadge status={result} />;
      },
    },
    {
      accessorKey: "inspection_date",
      header: "Date",
      cell: ({ row }) => formatDate(row.getValue("inspection_date")),
    },
  ];

  const total = inspections.length;
  const pending = inspections.filter((i: any) => i.status === "pending" || i.status === "in_progress").length;
  const accepted = inspections.filter((i: any) => i.result === "accepted" || i.result === "pass").length;
  const rejected = inspections.filter((i: any) => i.result === "rejected" || i.result === "fail").length;

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Inspections" value={total} icon={ClipboardCheck} />
        <KPICard title="Pending" value={pending} icon={AlertTriangle} variant="warning" />
        <KPICard title="Accepted" value={accepted} icon={CheckCircle} variant="success" />
        <KPICard title="Rejected" value={rejected} icon={XCircle} variant="danger" />
      </div>
      <DataTable columns={columns} data={inspections} isLoading={isLoading} />
    </div>
  );
}
