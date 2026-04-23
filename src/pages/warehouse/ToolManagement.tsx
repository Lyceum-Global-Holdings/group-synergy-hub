import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Wrench, ArrowRightLeft, RotateCcw, AlertTriangle, ChevronDown, Layers, FileSpreadsheet, PackagePlus } from "lucide-react";
import { useWarehouseTools } from "@/hooks/useWarehouseTools";
import { useToolIssues } from "@/hooks/useToolIssues";
import { useToolReturns } from "@/hooks/useToolReturns";
import { ToolsInventoryTab } from "@/components/warehouse/tools/ToolsInventoryTab";
import { ToolIssuesTab } from "@/components/warehouse/tools/ToolIssuesTab";
import { ToolReturnsTab } from "@/components/warehouse/tools/ToolReturnsTab";
import { OverdueToolsTab } from "@/components/warehouse/tools/OverdueToolsTab";
import { CreateToolDialog } from "@/components/warehouse/tools/CreateToolDialog";
import { EditToolDialog } from "@/components/warehouse/tools/EditToolDialog";
import { IssueToolDialog } from "@/components/warehouse/tools/IssueToolDialog";
import { ReturnToolDialog } from "@/components/warehouse/tools/ReturnToolDialog";
import { BulkIssueToolDialog } from "@/components/warehouse/tools/BulkIssueToolDialog";
import { BulkReturnToolDialog } from "@/components/warehouse/tools/BulkReturnToolDialog";
import { BulkToolImportDialog } from "@/components/warehouse/tools/BulkToolImportDialog";
import { ImportFromItemMasterDialog } from "@/components/warehouse/tools/ImportFromItemMasterDialog";
import { ToolAdjustmentDialog } from "@/components/warehouse/tools/ToolAdjustmentDialog";
import { Badge } from "@/components/ui/badge";
import { WarehouseTool } from "@/types/toolManagement";

export default function ToolManagement() {
  const [activeTab, setActiveTab] = useState("inventory");
  const [showCreateTool, setShowCreateTool] = useState(false);
  const [showIssueTool, setShowIssueTool] = useState(false);
  const [showReturnTool, setShowReturnTool] = useState(false);
  const [showBulkIssueTool, setShowBulkIssueTool] = useState(false);
  const [showBulkReturnTool, setShowBulkReturnTool] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showAdjustTool, setShowAdjustTool] = useState(false);
  const [showEditTool, setShowEditTool] = useState(false);
  const [selectedToolForAdjustment, setSelectedToolForAdjustment] = useState<WarehouseTool | null>(null);
  const [selectedToolForEdit, setSelectedToolForEdit] = useState<WarehouseTool | null>(null);

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" />
                Return Tool
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowReturnTool(true)}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Single Return
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowBulkReturnTool(true)}>
                <Layers className="h-4 w-4 mr-2" />
                Bulk Return
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Issue Tool
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowIssueTool(true)}>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Single Issue
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowBulkIssueTool(true)}>
                <Layers className="h-4 w-4 mr-2" />
                Bulk Issue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Tool
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowCreateTool(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Single Tool
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowBulkImport(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Bulk Import from CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          <ToolsInventoryTab 
            tools={tools} 
            isLoading={isLoadingTools}
            onAdjustQuantity={(tool) => {
              setSelectedToolForAdjustment(tool);
              setShowAdjustTool(true);
            }}
            onEditTool={(tool) => {
              setSelectedToolForEdit(tool);
              setShowEditTool(true);
            }}
          />
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
      <BulkIssueToolDialog open={showBulkIssueTool} onOpenChange={setShowBulkIssueTool} tools={tools} />
      <BulkReturnToolDialog open={showBulkReturnTool} onOpenChange={setShowBulkReturnTool} activeIssues={activeIssues} />
      <BulkToolImportDialog open={showBulkImport} onOpenChange={setShowBulkImport} />
      <ToolAdjustmentDialog 
        open={showAdjustTool} 
        onOpenChange={setShowAdjustTool} 
        tool={selectedToolForAdjustment}
      />
      {selectedToolForEdit && (
        <EditToolDialog
          open={showEditTool}
          onOpenChange={setShowEditTool}
          tool={selectedToolForEdit}
        />
      )}
    </div>
  );
}
