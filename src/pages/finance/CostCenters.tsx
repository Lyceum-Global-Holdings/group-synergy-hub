import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FolderTree, DollarSign, BarChart3, Building, Download } from "lucide-react";
import { CostCenterTree } from "@/components/finance/controlling/CostCenterTree";
import { CostCenterAnalysis } from "@/components/finance/controlling/CostCenterAnalysis";
import { ProfitCenterList } from "@/components/finance/controlling/ProfitCenterList";
import { CostAllocationReport } from "@/components/finance/controlling/CostAllocationReport";
import { CreateCostCenterDialog } from "@/components/finance/controlling/CreateCostCenterDialog";
import { CreateProfitCenterDialog } from "@/components/finance/controlling/CreateProfitCenterDialog";

export default function CostCenters() {
  const [activeTab, setActiveTab] = useState("cost-centers");
  const [showCostCenterDialog, setShowCostCenterDialog] = useState(false);
  const [showProfitCenterDialog, setShowProfitCenterDialog] = useState(false);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cost & Profit Centers</h1>
          <p className="text-muted-foreground">
            Controlling module - manage cost centers, profit centers, and allocations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {activeTab === "cost-centers" && (
            <Button onClick={() => setShowCostCenterDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Cost Center
            </Button>
          )}
          {activeTab === "profit-centers" && (
            <Button onClick={() => setShowProfitCenterDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Profit Center
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="cost-centers" className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            Cost Centers
          </TabsTrigger>
          <TabsTrigger value="profit-centers" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Profit Centers
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Cost Analysis
          </TabsTrigger>
          <TabsTrigger value="allocation" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Allocations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cost-centers">
          <CostCenterTree />
        </TabsContent>

        <TabsContent value="profit-centers">
          <ProfitCenterList />
        </TabsContent>

        <TabsContent value="analysis">
          <CostCenterAnalysis />
        </TabsContent>

        <TabsContent value="allocation">
          <CostAllocationReport />
        </TabsContent>
      </Tabs>

      <CreateCostCenterDialog 
        open={showCostCenterDialog} 
        onOpenChange={setShowCostCenterDialog} 
      />
      
      <CreateProfitCenterDialog 
        open={showProfitCenterDialog} 
        onOpenChange={setShowProfitCenterDialog} 
      />
    </div>
  );
}
