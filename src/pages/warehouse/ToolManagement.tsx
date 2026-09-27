import { useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Wrench, ArrowRightLeft, RotateCcw, AlertTriangle, ChevronDown, Layers, FileSpreadsheet, PackagePlus, FileBarChart, Gauge, CheckCircle2, Clock, Boxes } from "lucide-react";
import { Command as CommandIcon, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useCompany } from "@/contexts/CompanyContext";
import { useToolDueSummary } from "@/hooks/useToolDueSummary";
import { ToolCommandMenu } from "@/components/warehouse/tools/ToolCommandMenu";
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
import { ManageToolUnitsDialog } from "@/components/warehouse/tools/ManageToolUnitsDialog";
import { ToolDueAlertsTab } from "@/components/warehouse/tools/ToolDueAlertsTab";
import { DeleteConfirmationDialog } from "@/components/admin/DeleteConfirmationDialog";
import { Badge } from "@/components/ui/badge";
import { WarehouseTool } from "@/types/toolManagement";
import { useAccessibleNav } from "@/components/layout/useAccessibleNav";

export default function ToolManagement() {
  const canOpenReports = useAccessibleNav().canOpenPath("/management/reports");
  const [activeTab, setActiveTab] = useState("inventory");
  const [showCreateTool, setShowCreateTool] = useState(false);
  const [showIssueTool, setShowIssueTool] = useState(false);
  const [showReturnTool, setShowReturnTool] = useState(false);
  const [showBulkIssueTool, setShowBulkIssueTool] = useState(false);
  const [showBulkReturnTool, setShowBulkReturnTool] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showImportFromItemMaster, setShowImportFromItemMaster] = useState(false);
  const [showAdjustTool, setShowAdjustTool] = useState(false);
  const [showEditTool, setShowEditTool] = useState(false);
  const [selectedToolForAdjustment, setSelectedToolForAdjustment] = useState<WarehouseTool | null>(null);
  const [selectedToolForEdit, setSelectedToolForEdit] = useState<WarehouseTool | null>(null);
  const [selectedToolForUnits, setSelectedToolForUnits] = useState<WarehouseTool | null>(null);
  const [showManageUnits, setShowManageUnits] = useState(false);
  const [selectedToolForDelete, setSelectedToolForDelete] = useState<WarehouseTool | null>(null);
  const [showDeleteTool, setShowDeleteTool] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  const { tools, isLoading: isLoadingTools, deleteTool, isDeleting } = useWarehouseTools();
  const { issues, activeIssues, overdueIssues, isLoading: isLoadingIssues } = useToolIssues();
  const { returns, isLoading: isLoadingReturns } = useToolReturns();
  const { selectedCompany } = useCompany();
  const { summary: due } = useToolDueSummary(selectedCompany?.id);

  const availableCount = tools.reduce((s, t) => s + (Number(t.available_quantity) || 0), 0);

  return (
    <div className="container mx-auto py-6 space-y-5">
      {/* Hero header */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/5 via-background to-background p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Tool Management</h1>
              <p className="text-sm text-muted-foreground">
                Serialized units · calibration · maintenance · issue &amp; return
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setCmdOpen(true)} className="text-muted-foreground">
            <CommandIcon className="h-4 w-4 mr-2" />
            Find action
            <kbd className="ml-2 hidden sm:inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[10px] font-medium">⌘K</kbd>
          </Button>
          {canOpenReports && (
            <Button asChild variant="outline">
              <Link to="/management/reports?template=WH-TOOL-LED-001">
                <FileBarChart className="h-4 w-4 mr-2" />
                Generate Report
              </Link>
            </Button>
          )}
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
              <DropdownMenuItem onClick={() => setShowImportFromItemMaster(true)}>
                <PackagePlus className="h-4 w-4 mr-2" />
                Import from Item Master
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowBulkImport(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Bulk Import from CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Tools" value={tools.length} icon={<Boxes className="h-4 w-4" />} tone="primary" />
        <StatCard label="Available" value={availableCount} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <StatCard label="On issue" value={activeIssues.length} icon={<ArrowRightLeft className="h-4 w-4" />} tone="info" />
        <StatCard label="Overdue" value={overdueIssues.length} icon={<Clock className="h-4 w-4" />} tone="destructive" />
        <StatCard label="Calibration due" value={due.calibration.count} icon={<Gauge className="h-4 w-4" />} tone="warning" />
        <StatCard label="Maintenance due" value={due.maintenance.count} icon={<Wrench className="h-4 w-4" />} tone="warning" />
      </div>

      {/* Capability shortcuts — surface the deeper features */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <CapabilityCard
          icon={<Boxes className="h-5 w-5" />}
          title="Serialized units & QR"
          desc="Register units, print QR labels, view per-unit history"
          onClick={() => setActiveTab("inventory")}
        />
        <CapabilityCard
          icon={<Gauge className="h-5 w-5" />}
          title="Calibration"
          desc="ISO/IEC 17025 · record & track due dates"
          badge={due.calibration.count}
          onClick={() => setActiveTab("due")}
        />
        <CapabilityCard
          icon={<Wrench className="h-5 w-5" />}
          title="Maintenance"
          desc="ISO 55000 · service history & schedules"
          badge={due.maintenance.count}
          onClick={() => setActiveTab("due")}
        />
        <CapabilityCard
          icon={<FileBarChart className="h-5 w-5" />}
          title="Reports"
          desc="Ledger, calibration, maintenance, cost"
          onClick={() => setCmdOpen(true)}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/60 p-1 h-auto flex-wrap gap-1">
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
          <TabsTrigger value="due" className="flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Due &amp; Alerts
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
            onDeleteTool={(tool) => {
              setSelectedToolForDelete(tool);
              setShowDeleteTool(true);
            }}
            onManageUnits={(tool) => {
              setSelectedToolForUnits(tool);
              setShowManageUnits(true);
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

        <TabsContent value="due" className="mt-6">
          <ToolDueAlertsTab />
        </TabsContent>
      </Tabs>

      <ToolCommandMenu
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        onAddTool={() => setShowCreateTool(true)}
        onImportItemMaster={() => setShowImportFromItemMaster(true)}
        onBulkImport={() => setShowBulkImport(true)}
        onIssue={() => setShowIssueTool(true)}
        onBulkIssue={() => setShowBulkIssueTool(true)}
        onReturn={() => setShowReturnTool(true)}
        onBulkReturn={() => setShowBulkReturnTool(true)}
        onGoTab={setActiveTab}
      />

      <CreateToolDialog open={showCreateTool} onOpenChange={setShowCreateTool} />
      <ManageToolUnitsDialog tool={selectedToolForUnits} open={showManageUnits} onOpenChange={setShowManageUnits} />
      <IssueToolDialog open={showIssueTool} onOpenChange={setShowIssueTool} tools={tools} />
      <ReturnToolDialog open={showReturnTool} onOpenChange={setShowReturnTool} activeIssues={activeIssues} />
      <BulkIssueToolDialog open={showBulkIssueTool} onOpenChange={setShowBulkIssueTool} tools={tools} />
      <BulkReturnToolDialog open={showBulkReturnTool} onOpenChange={setShowBulkReturnTool} activeIssues={activeIssues} />
      <BulkToolImportDialog open={showBulkImport} onOpenChange={setShowBulkImport} />
      <ImportFromItemMasterDialog
        open={showImportFromItemMaster}
        onOpenChange={setShowImportFromItemMaster}
      />
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
      <DeleteConfirmationDialog
        open={showDeleteTool}
        onOpenChange={(open) => {
          setShowDeleteTool(open);
          if (!open) setSelectedToolForDelete(null);
        }}
        title="Delete tool"
        description="This permanently removes the tool master record. Historical issues and returns are preserved for audit."
        itemName={selectedToolForDelete ? `${selectedToolForDelete.tool_code} — ${selectedToolForDelete.name}` : undefined}
        destructiveText="Delete tool"
        isLoading={isDeleting}
        onConfirm={() => {
          if (!selectedToolForDelete) return;
          deleteTool(selectedToolForDelete.id, {
            onSuccess: () => {
              setShowDeleteTool(false);
              setSelectedToolForDelete(null);
            },
          });
        }}
      />
    </div>
  );
}

function CapabilityCard({ icon, title, desc, badge, onClick }: {
  icon: React.ReactNode; title: string; desc: string; badge?: number; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        <span className="p-2 rounded-md bg-primary/10 text-primary shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">{title}</h3>
            {badge != null && badge > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5">{badge}</Badge>
            )}
            <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</p>
        </div>
      </div>
    </button>
  );
}

type StatTone = "primary" | "success" | "info" | "warning" | "destructive";

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: StatTone }) {
  const toneMap: Record<StatTone, { chip: string; rail: string; val: string }> = {
    primary: { chip: "bg-primary/10 text-primary", rail: "border-l-primary", val: "text-foreground" },
    success: { chip: "bg-success/10 text-success", rail: "border-l-success", val: "text-foreground" },
    info: { chip: "bg-info/10 text-info", rail: "border-l-info", val: "text-foreground" },
    warning: { chip: "bg-warning/10 text-warning", rail: "border-l-warning", val: value > 0 ? "text-warning" : "text-foreground" },
    destructive: { chip: "bg-destructive/10 text-destructive", rail: "border-l-destructive", val: value > 0 ? "text-destructive" : "text-foreground" },
  };
  const t = toneMap[tone];
  return (
    <Card className={`p-3.5 border-l-2 ${t.rail}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={`p-1.5 rounded-md ${t.chip}`}>{icon}</span>
      </div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${t.val}`}>{value.toLocaleString()}</div>
    </Card>
  );
}
