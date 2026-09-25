import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, TrendingUp, Package, CheckCircle, Clock, Settings2, Wrench, Layers, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStockTransferRequests } from "@/hooks/useStockTransfer";
import { CreateStockTransferDialog } from "@/components/warehouse/CreateStockTransferDialog";
import { StockTransferDetailsDialog } from "@/components/warehouse/StockTransferDetailsDialog";
import { BulkAdjustmentDialog } from "@/components/warehouse/BulkAdjustmentDialog";
import { StockMovementReportDialog } from "@/components/warehouse/StockMovementReportDialog";
import { useIsAdminOrHigher } from "@/hooks/useIsAdminOrHigher";
import { useCompany } from "@/contexts/CompanyContext";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import type { StockTransferRequest } from "@/types/stockTransfer";
import { format } from "date-fns";
import { useOpenFromQuery } from "@/hooks/useOpenFromQuery";

export default function StockTransfer() {
  const navigate = useNavigate();
  const { canDelete } = useIsAdminOrHigher();
  const { selectedCompany } = useCompany();
  const { globalLocationId } = useLocationFilter();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  // Header quick-create menu links here with ?new=…
  useOpenFromQuery("new", { "1": () => setCreateDialogOpen(true) });
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransferRequest | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [showBulkAdjustmentDialog, setShowBulkAdjustmentDialog] = useState(false);
  const [showMovementReportDialog, setShowMovementReportDialog] = useState(false);

  const { data: allTransfers = [], isLoading } = useStockTransferRequests(
    undefined,
    selectedCompany?.id ?? null,
    globalLocationId,
  );

  const draftTransfers = allTransfers.filter((t) => t.status === "draft");
  const pendingTransfers = allTransfers.filter((t) => t.status === "pending_approval");
  const inTransitTransfers = allTransfers.filter((t) => t.status === "in_transit" || t.status === "approved");
  const completedTransfers = allTransfers.filter((t) => t.status === "completed");

  const handleViewDetails = (transfer: StockTransferRequest) => {
    setSelectedTransfer(transfer);
    setDetailsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      draft: "secondary",
      pending_approval: "outline",
      approved: "default",
      in_transit: "default",
      completed: "secondary",
      cancelled: "destructive",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {status.replace(/_/g, " ").toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: "text-muted-foreground",
      normal: "text-primary",
      high: "text-orange-500",
      urgent: "text-destructive",
    };

    return <span className={colors[priority] || ""}>{priority.toUpperCase()}</span>;
  };

  const renderTransferTable = (transfers: StockTransferRequest[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Transfer #</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transfers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground">
              No transfers found
            </TableCell>
          </TableRow>
        ) : (
          transfers.map((transfer) => (
            <TableRow key={transfer.id}>
              <TableCell className="font-medium">{transfer.transfer_number}</TableCell>
              <TableCell>{format(new Date(transfer.transfer_date), "MMM dd, yyyy")}</TableCell>
              <TableCell className="text-sm">
                <div className="space-y-0.5">
                  {transfer.from_location?.name && <div>{transfer.from_location.name}</div>}
                  {transfer.from_sublocation?.name && <div className="text-muted-foreground text-xs">{transfer.from_sublocation.name}</div>}
                  {transfer.from_department?.name && <div className="text-muted-foreground text-xs">{transfer.from_department.name}</div>}
                  {!transfer.from_location?.name && !transfer.from_department?.name && <span className="text-muted-foreground">-</span>}
                </div>
              </TableCell>
              <TableCell className="text-sm">
                <div className="space-y-0.5">
                  {transfer.to_location?.name && <div>{transfer.to_location.name}</div>}
                  {transfer.to_sublocation?.name && <div className="text-muted-foreground text-xs">{transfer.to_sublocation.name}</div>}
                  {transfer.to_department?.name && <div className="text-muted-foreground text-xs">{transfer.to_department.name}</div>}
                  {!transfer.to_location?.name && !transfer.to_department?.name && <span className="text-muted-foreground">-</span>}
                </div>
              </TableCell>
              <TableCell>{transfer.transfer_type}</TableCell>
              <TableCell>{getPriorityBadge(transfer.priority)}</TableCell>
              <TableCell>{getStatusBadge(transfer.status)}</TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewDetails(transfer)}
                >
                  View Details
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Stock Transfer</h1>
          <p className="text-muted-foreground">Manage stock transfers between locations</p>
        </div>
        <div className="flex gap-2">
          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Settings2 className="mr-2 h-4 w-4" />
                  Admin Tools
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => navigate('/warehouse/stock-adjustment')}>
                  <Wrench className="mr-2 h-4 w-4" />
                  Quick Adjustment
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowBulkAdjustmentDialog(true)}>
                  <Layers className="mr-2 h-4 w-4" />
                  Bulk Adjustment
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowMovementReportDialog(true)}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Stock Movement Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Transfer
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftTransfers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTransfers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inTransitTransfers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTransfers.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Transfers</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="pending">Pending Approval</TabsTrigger>
          <TabsTrigger value="in_transit">In Transit</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {renderTransferTable(allTransfers)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="draft" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {renderTransferTable(draftTransfers)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {renderTransferTable(pendingTransfers)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="in_transit" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {renderTransferTable(inTransitTransfers)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {renderTransferTable(completedTransfers)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateStockTransferDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {selectedTransfer && (
        <StockTransferDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          transfer={selectedTransfer}
        />
      )}

      <BulkAdjustmentDialog
        open={showBulkAdjustmentDialog}
        onOpenChange={setShowBulkAdjustmentDialog}
      />

      <StockMovementReportDialog
        open={showMovementReportDialog}
        onOpenChange={setShowMovementReportDialog}
      />
    </div>
  );
}
