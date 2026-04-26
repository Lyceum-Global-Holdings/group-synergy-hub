import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Factory } from "lucide-react";
import ProductionDashboard from "@/components/production/ProductionDashboard";
import ProductionOrdersList from "@/components/production/ProductionOrdersList";
import StagePlannerDialog from "@/components/production/StagePlannerDialog";
import ProductionOrderDetail from "@/components/production/ProductionOrderDetail";
import DailyProductionSummary from "@/components/production/DailyProductionSummary";
import { GenerateReportButton } from "@/components/management/reports/GenerateReportButton";

export default function ProductionModule() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  if (selectedOrderId) {
    return <ProductionOrderDetail orderId={selectedOrderId} onBack={() => setSelectedOrderId(null)} />;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Factory className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Production</h1>
            <p className="text-sm text-muted-foreground">WIP tracking & stage-wise cost management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GenerateReportButton
            templates={["PD-WIP-001", "PD-DAILY-001", "PD-STG-COST-001", "PD-EFF-001"]}
          />
          <StagePlannerDialog />
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="orders">Production Orders</TabsTrigger>
          <TabsTrigger value="daily-summary">Daily Summary</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <ProductionDashboard onViewOrder={setSelectedOrderId} />
        </TabsContent>
        <TabsContent value="orders">
          <ProductionOrdersList onViewOrder={setSelectedOrderId} />
        </TabsContent>
        <TabsContent value="daily-summary">
          <DailyProductionSummary />
        </TabsContent>
      </Tabs>
    </div>
  );
}
