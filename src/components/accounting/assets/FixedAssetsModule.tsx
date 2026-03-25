import { useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { QuickActions } from "../QuickActions";
import { AssetRegister } from "@/components/finance/assets/AssetRegister";
import { DepreciationScheduleView } from "@/components/finance/assets/DepreciationScheduleView";
import { AssetTransactionList } from "@/components/finance/assets/AssetTransactionList";
import { AssetReports } from "@/components/finance/assets/AssetReports";
import { RunDepreciationDialog } from "@/components/finance/assets/RunDepreciationDialog";
import { Play, Download, MapPin } from "lucide-react";
import { AssetLocationReportDialog } from "@/components/finance/assets/AssetLocationReportDialog";

const subTabs = [
  { id: "register", label: "Asset Register" },
  { id: "depreciation", label: "Depreciation" },
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

  const quickActions = [
    { label: "Run Depreciation", icon: Play, onClick: () => setShowDepreciationDialog(true) },
    { label: "Location Report", icon: MapPin, onClick: () => setShowLocationReportDialog(true) },
    { label: "Export", icon: Download, onClick: () => {} },
  ];

  return (
    <>
      <ModuleSubTabs tabs={subTabs} activeTab={activeSubTab || "register"} onTabChange={onSubTabChange}>
        <TabsContent value="register" className="mt-4 space-y-6">
          <QuickActions actions={quickActions} />
          <AssetRegister />
        </TabsContent>

        <TabsContent value="depreciation" className="mt-4 space-y-6">
          <QuickActions actions={[quickActions[0]]} />
          <DepreciationScheduleView />
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