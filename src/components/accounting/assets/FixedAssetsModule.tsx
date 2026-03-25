import { useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { QuickActions } from "../QuickActions";
import { KPICard } from "../KPICard";
import { AssetRegister } from "@/components/finance/assets/AssetRegister";
import { DepreciationScheduleView } from "@/components/finance/assets/DepreciationScheduleView";
import { AssetTransactionList } from "@/components/finance/assets/AssetTransactionList";
import { AssetReports } from "@/components/finance/assets/AssetReports";
import { RunDepreciationDialog } from "@/components/finance/assets/RunDepreciationDialog";
import { AssetLocationReportDialog } from "@/components/finance/assets/AssetLocationReportDialog";
import { DataTable, DataTableColumn } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useFixedAssetStats, useAssetRevaluations, useAssetDisposals } from "@/hooks/finance/useFixedAssets";
import { useFormatCurrency, useFormatDate } from "@/lib/formatters";
import { Play, Download, MapPin, Package, TrendingUp, Trash2, ArrowLeftRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const subTabs = [
  { id: "register", label: "Asset Register" },
  { id: "depreciation", label: "Depreciation" },
  { id: "revaluations", label: "Revaluations" },
  { id: "transfers", label: "Transfers" },
  { id: "disposals", label: "Disposals" },
  { id: "transactions", label: "Transactions" },
  { id: "reports", label: "Reports" },
];

interface FixedAssetsModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function FixedAssetsModule({ activeSubTab, onSubTabChange }: FixedAssetsModuleProps) {
  const [showDepreciationDialog, setShowDepreciationDialog] = useState(false);
  const [showLocationReportDialog, setShowLocationReportDialog] = useState(false);
  const { data: stats } = useFixedAssetStats();
  const { data: revaluations = [], isLoading: revalLoading } = useAssetRevaluations();
  const { data: disposals = [], isLoading: disposalLoading } = useAssetDisposals();
  const fmt = useFormatCurrency();
  const fmtDate = useFormatDate();

  const quickActions = [
    { label: "Run Depreciation", icon: Play, onClick: () => setShowDepreciationDialog(true) },
    { label: "Location Report", icon: MapPin, onClick: () => setShowLocationReportDialog(true) },
    { label: "Export", icon: Download, onClick: () => {} },
  ];

  const revalColumns: DataTableColumn<Record<string, unknown>>[] = [
    { key: "revaluation_date", header: "Date", render: (r) => fmtDate(r.revaluation_date as string) },
    { key: "asset", header: "Asset", render: (r) => {
      const asset = r.asset as Record<string, unknown> | null;
      return asset?.name as string || "—";
    }},
    { key: "old_value", header: "Old Value", render: (r) => fmt(r.old_value as number) },
    { key: "new_value", header: "New Value", render: (r) => fmt(r.new_value as number) },
    { key: "adjustment_amount", header: "Adjustment", render: (r) => {
      const amt = r.adjustment_amount as number;
      return <span className={amt >= 0 ? "text-green-600" : "text-red-600"}>{fmt(amt)}</span>;
    }},
    { key: "reason", header: "Reason" },
  ];

  const disposalColumns: DataTableColumn<Record<string, unknown>>[] = [
    { key: "disposal_date", header: "Date", render: (r) => fmtDate(r.disposal_date as string) },
    { key: "asset", header: "Asset", render: (r) => {
      const asset = r.asset as Record<string, unknown> | null;
      return asset?.name as string || "—";
    }},
    { key: "disposal_method", header: "Method", render: (r) => <span className="capitalize">{(r.disposal_method as string) || "—"}</span> },
    { key: "proceeds", header: "Proceeds", render: (r) => fmt(r.proceeds as number) },
    { key: "net_book_value_at_disposal", header: "NBV", render: (r) => fmt(r.net_book_value_at_disposal as number) },
    { key: "gain_loss", header: "Gain/Loss", render: (r) => {
      const gl = r.gain_loss as number;
      return <span className={gl >= 0 ? "text-green-600" : "text-red-600"}>{fmt(gl)}</span>;
    }},
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status as string} /> },
  ];

  return (
    <>
      <ModuleSubTabs tabs={subTabs} activeTab={activeSubTab || "register"} onTabChange={onSubTabChange}>
        <TabsContent value="register" className="mt-4 space-y-6">
          <QuickActions actions={quickActions} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard icon={Package} label="Total Assets" value={stats?.total ?? "—"} variant="primary" />
            <KPICard icon={TrendingUp} label="Active Assets" value={stats?.active ?? "—"} variant="success" />
            <KPICard icon={Download} label="Total Value" value={fmt(stats?.totalValue)} variant="default" />
            <KPICard icon={ArrowLeftRight} label="Total Depreciation" value={fmt(stats?.depreciated)} variant="warning" />
          </div>
          <AssetRegister />
        </TabsContent>

        <TabsContent value="depreciation" className="mt-4 space-y-6">
          <QuickActions actions={[quickActions[0]]} />
          <DepreciationScheduleView />
        </TabsContent>

        <TabsContent value="revaluations" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Asset Revaluations</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={revalColumns}
                data={revaluations as unknown as Record<string, unknown>[]}
                isLoading={revalLoading}
                emptyMessage="No revaluations recorded yet."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfers" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Asset Transfers</CardTitle>
            </CardHeader>
            <CardContent>
              <AssetTransactionList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disposals" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Asset Disposals</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={disposalColumns}
                data={disposals as unknown as Record<string, unknown>[]}
                isLoading={disposalLoading}
                emptyMessage="No disposals recorded yet."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <AssetTransactionList />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <AssetReports />
        </TabsContent>
      </ModuleSubTabs>

      <RunDepreciationDialog open={showDepreciationDialog} onOpenChange={setShowDepreciationDialog} />
      <AssetLocationReportDialog open={showLocationReportDialog} onOpenChange={setShowLocationReportDialog} />
    </>
  );
}
