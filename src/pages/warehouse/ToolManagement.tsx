import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Wrench, ArrowRightLeft, RotateCcw, AlertTriangle } from "lucide-react";
import { useWarehouseTools } from "@/hooks/useWarehouseTools";
import { useToolIssues } from "@/hooks/useToolIssues";
import { useToolReturns } from "@/hooks/useToolReturns";
import { ToolsInventoryTab } from "@/components/warehouse/tools/ToolsInventoryTab";
import { ToolIssuesTab } from "@/components/warehouse/tools/ToolIssuesTab";
import { ToolReturnsTab } from "@/components/warehouse/tools/ToolReturnsTab";
import { OverdueToolsTab } from "@/components/warehouse/tools/OverdueToolsTab";
import { CreateToolDialog } from "@/components/warehouse/tools/CreateToolDialog";
import { IssueToolDialog } from "@/components/warehouse/tools/IssueToolDialog";
import { ReturnToolDialog } from "@/components/warehouse/tools/ReturnToolDialog";
import { Badge } from "@/components/ui/badge";

export default function ToolManagement() {
  const [activeTab, setActiveTab] = useState("inventory");
  const [showCreateTool, setShowCreateTool] = useState(false);
  const [showIssueTool, setShowIssueTool] = useState(false);
  const [showReturnTool, setShowReturnTool] = useState(false);

  const { tools, isLoading: isLoadingTools } = useWarehouseTools();
  const { issues, activeIssues, overdueIssues, isLoading: isLoadingIssues } = useToolIssues();
  const { returns, isLoading: isLoadingReturns } = useToolReturns();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wrench className="h-8 w-8" />
            Tool Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage tools, track issues and returns
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowReturnTool(true)}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Return Tool
          </Button>
          <Button variant="outline" onClick={() => setShowIssueTool(true)}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Issue Tool
          </Button>
          <Button onClick={() => setShowCreateTool(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Tool
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Tools Inventory
            <Badge variant="secondary">{tools.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="issues" className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Tool Issues
            <Badge variant="secondary">{activeIssues.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="returns" className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Returns
            <Badge variant="secondary">{returns.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="overdue" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Overdue
            {overdueIssues.length > 0 && (
              <Badge variant="destructive">{overdueIssues.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-6">
          <ToolsInventoryTab tools={tools} isLoading={isLoadingTools} />
        </TabsContent>

        <TabsContent value="issues" className="mt-6">
          <ToolIssuesTab issues={issues} isLoading={isLoadingIssues} />
        </TabsContent>

        <TabsContent value="returns" className="mt-6">
          <ToolReturnsTab returns={returns} isLoading={isLoadingReturns} />
        </TabsContent>

        <TabsContent value="overdue" className="mt-6">
          <OverdueToolsTab issues={overdueIssues} isLoading={isLoadingIssues} />
        </TabsContent>
      </Tabs>

      <CreateToolDialog open={showCreateTool} onOpenChange={setShowCreateTool} />
      <IssueToolDialog open={showIssueTool} onOpenChange={setShowIssueTool} tools={tools} />
      <ReturnToolDialog open={showReturnTool} onOpenChange={setShowReturnTool} activeIssues={activeIssues} />
    </div>
  );
}
