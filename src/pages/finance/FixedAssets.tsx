import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Package, Calculator, ArrowRightLeft, FileText, Download, Play, MapPin } from "lucide-react";
import { AssetRegister } from "@/components/finance/assets/AssetRegister";
import { DepreciationScheduleView } from "@/components/finance/assets/DepreciationScheduleView";
import { AssetTransactionList } from "@/components/finance/assets/AssetTransactionList";
import { AssetReports } from "@/components/finance/assets/AssetReports";
import { RunDepreciationDialog } from "@/components/finance/assets/RunDepreciationDialog";
import { AssetLocationReportDialog } from "@/components/finance/assets/AssetLocationReportDialog";

export default function FixedAssets() {
  const [activeTab, setActiveTab] = useState("register");
  const [showDepreciationDialog, setShowDepreciationDialog] = useState(false);
  const [showLocationReportDialog, setShowLocationReportDialog] = useState(false);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fixed Assets</h1>
          <p className="text-muted-foreground">
            Asset register, depreciation, and asset accounting
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowLocationReportDialog(true)}>
            <MapPin className="h-4 w-4 mr-2" />
            Location Report
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowDepreciationDialog(true)}>
            <Play className="h-4 w-4 mr-2" />
            Run Depreciation
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="register" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Asset Register
          </TabsTrigger>
          <TabsTrigger value="depreciation" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Depreciation
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="register">
          <AssetRegister />
        </TabsContent>

        <TabsContent value="depreciation">
          <DepreciationScheduleView />
        </TabsContent>

        <TabsContent value="transactions">
          <AssetTransactionList />
        </TabsContent>

        <TabsContent value="reports">
          <AssetReports />
        </TabsContent>
      </Tabs>

      <RunDepreciationDialog 
        open={showDepreciationDialog} 
        onOpenChange={setShowDepreciationDialog} 
      />

      <AssetLocationReportDialog
        open={showLocationReportDialog}
        onOpenChange={setShowLocationReportDialog}
      />
    </div>
  );
}
