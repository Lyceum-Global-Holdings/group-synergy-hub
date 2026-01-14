import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCpoView } from "@/hooks/useCpoView";
import { useCustomerPurchaseOrders } from "@/hooks/useCustomerPurchaseOrders";
import { useCpoWorkflow } from "@/hooks/useCpoWorkflow";
import { useIsAdmin, useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import CpoApprovalDialog from "@/components/tuh-modules/customer-po/CpoApprovalDialog";
import {
  ArrowLeft,
  FileText,
  Package,
  Calendar,
  DollarSign,
  User,
  MapPin,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Printer,
  Download,
  Edit,
  MoreVertical,
  Send,
  Ban,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";

export default function CustomerPoView() {
  const { cpoId } = useParams<{ cpoId: string }>();
  const navigate = useNavigate();
  const { cpo, reservations, materialIssues, activityLog, isLoading, error } = useCpoView(cpoId!);
  
  // Approval state and hooks
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  
  const { approveCPO, submitForApproval, cancelCPO, isApproving, isSubmitting, isCancelling } = useCustomerPurchaseOrders();
  const { createMaterialDemandFromCPO, isCreatingMaterialDemand } = useCpoWorkflow(cpoId!);
  const { data: isAdmin } = useIsAdmin();
  const { data: isSuperAdmin } = useSuperAdmin();
  
  // Determine available actions based on status and role
  const canSubmitForApproval = cpo?.status === 'draft';
  const canApprove = cpo?.status === 'pending_approval' && (isAdmin || isSuperAdmin);
  const canProceedToNextStage = cpo?.status === 'confirmed';
  const canCancel = ['draft', 'pending_approval', 'confirmed'].includes(cpo?.status || '') && cpo?.status !== 'cancelled';
  
  const handleSubmitForApproval = () => {
    if (!cpoId) return;
    submitForApproval.mutate(cpoId, {
      onSuccess: () => toast.success("CPO submitted for approval"),
    });
  };
  
  const handleApprovalSubmit = (action: 'approved' | 'rejected', comments?: string) => {
    if (!cpoId) return;
    approveCPO.mutate(
      { id: cpoId, action, comments },
      { onSuccess: () => setApprovalDialogOpen(false) }
    );
  };
  
  const handleCancel = () => {
    if (!cpoId) return;
    if (confirm("Are you sure you want to cancel this Customer PO?")) {
      cancelCPO.mutate({ id: cpoId, reason: "Cancelled by user" });
    }
  };
  
  const handleMaterialDemandPlanning = () => {
    if (!cpoId) return;
    createMaterialDemandFromCPO.mutate({
      cpoId,
      analysisDate: new Date().toISOString().split('T')[0]
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !cpo) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <AlertCircle className="h-12 w-12 mx-auto mb-4" />
              <p>Failed to load customer purchase order</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      pending_approval: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      confirmed: "bg-green-500/10 text-green-500 border-green-500/20",
      in_production: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      delivered: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      completed: "bg-green-600/10 text-green-600 border-green-600/20",
      rejected: "bg-destructive/10 text-destructive border-destructive/20",
      cancelled: "bg-muted text-muted-foreground",
    };
    return colors[status] || colors.draft;
  };

  const totalAmount = cpo.items?.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0) || 0;
  const totalItems = cpo.items?.length || 0;
  const totalQuantity = cpo.items?.reduce((sum: number, item: any) => sum + (item.quantity_ordered || 0), 0) || 0;

  const itemsColumns: ColumnDef<any>[] = [
    {
      accessorKey: "item_name",
      header: "Item Name",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.item_name}</div>
          {row.original.description && (
            <div className="text-sm text-muted-foreground">{row.original.description}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "color",
      header: "Color",
    },
    {
      accessorKey: "size",
      header: "Size",
    },
    {
      accessorKey: "quantity_ordered",
      header: "Quantity",
      cell: ({ row }) => (
        <div className="text-right">{row.original.quantity_ordered?.toLocaleString()}</div>
      ),
    },
    {
      accessorKey: "unit_price",
      header: "Unit Price",
      cell: ({ row }) => (
        <div className="text-right">${row.original.unit_price?.toFixed(2)}</div>
      ),
    },
    {
      accessorKey: "total_price",
      header: "Total",
      cell: ({ row }) => (
        <div className="text-right font-medium">${row.original.total_price?.toFixed(2)}</div>
      ),
    },
    {
      accessorKey: "delivery_date",
      header: "Delivery Date",
      cell: ({ row }) => row.original.delivery_date ? format(new Date(row.original.delivery_date), "MMM dd, yyyy") : "-",
    },
  ];

  const reservationsColumns: ColumnDef<any>[] = [
    {
      accessorKey: "warehouse_item.item_code",
      header: "Item Code",
    },
    {
      accessorKey: "warehouse_item.name",
      header: "Item Name",
    },
    {
      accessorKey: "reserved_quantity",
      header: "Reserved Qty",
      cell: ({ row }) => row.original.reserved_quantity?.toLocaleString(),
    },
    {
      accessorKey: "quantity_issued",
      header: "Issued Qty",
      cell: ({ row }) => row.original.quantity_issued?.toLocaleString(),
    },
    {
      accessorKey: "quantity_remaining",
      header: "Remaining",
      cell: ({ row }) => row.original.quantity_remaining?.toLocaleString(),
    },
    {
      accessorKey: "bin_allocation.warehouse_bin.bin_code",
      header: "Bin Location",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className={getStatusColor(row.original.status)}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "reserved_date",
      header: "Reserved Date",
      cell: ({ row }) => format(new Date(row.original.reserved_date), "MMM dd, yyyy"),
    },
  ];

  const materialIssuesColumns: ColumnDef<any>[] = [
    {
      accessorKey: "min_number",
      header: "MIN Number",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.min_number}</div>
      ),
    },
    {
      accessorKey: "issue_date",
      header: "Issue Date",
      cell: ({ row }) => format(new Date(row.original.issue_date), "MMM dd, yyyy"),
    },
    {
      header: "Items Count",
      cell: ({ row }) => row.original.items?.length || 0,
    },
    {
      header: "Total Qty",
      cell: ({ row }) => {
        const total = row.original.items?.reduce((sum: number, item: any) => sum + (item.quantity_issued || 0), 0) || 0;
        return total.toLocaleString();
      },
    },
    {
      accessorKey: "issued_by_profile.full_name",
      header: "Issued By",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className={getStatusColor(row.original.status)}>
          {row.original.status}
        </Badge>
      ),
    },
  ];

  const activityColumns: ColumnDef<any>[] = [
    {
      accessorKey: "movement_date",
      header: "Date & Time",
      cell: ({ row }) => format(new Date(row.original.movement_date), "MMM dd, yyyy HH:mm"),
    },
    {
      accessorKey: "movement_type",
      header: "Action",
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.movement_type}</Badge>
      ),
    },
    {
      accessorKey: "warehouse_item.item_code",
      header: "Item",
    },
    {
      accessorKey: "quantity",
      header: "Quantity",
      cell: ({ row }) => {
        const qty = row.original.quantity || 0;
        const type = row.original.movement_type;
        const isPositive = type === 'receipt' || type === 'return' || type === 'adjustment_in';
        return (
          <span className={isPositive ? "text-green-600" : "text-destructive"}>
            {isPositive ? '+' : '-'}{Math.abs(qty).toLocaleString()}
          </span>
        );
      },
    },
    {
      accessorKey: "performed_by_profile.full_name",
      header: "Performed By",
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => (
        <div className="max-w-xs truncate">{row.original.notes || "-"}</div>
      ),
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{cpo.cpo_number}</h1>
              <Badge variant="outline" className={`${getStatusColor(cpo.status)} border`}>
                {cpo.status?.replace(/_/g, ' ')}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              Customer Purchase Order Details
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <div className="text-2xl font-bold">${totalAmount.toFixed(2)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <div className="text-2xl font-bold">{totalItems}</div>
              <span className="text-sm text-muted-foreground">({totalQuantity.toLocaleString()} units)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Delivery Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <div className="text-2xl font-bold">
                {cpo.delivery_date ? format(new Date(cpo.delivery_date), "MMM dd") : "-"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Workflow Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <div className="text-2xl font-bold">
                {cpo.workflow?.[cpo.workflow.length - 1]?.workflow_stage || "Created"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons Card */}
      {(canSubmitForApproval || canApprove || canProceedToNextStage || canCancel) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Actions</CardTitle>
            <CardDescription>Available actions for this Customer PO</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {/* Submit for Approval - for draft CPOs */}
              {canSubmitForApproval && (
                <Button onClick={handleSubmitForApproval} disabled={isSubmitting}>
                  <Send className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
                </Button>
              )}
              
              {/* Approve - for managers on pending_approval CPOs */}
              {canApprove && (
                <Button 
                  onClick={() => { 
                    setApprovalAction('approve'); 
                    setApprovalDialogOpen(true); 
                  }}
                  disabled={isApproving}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              )}
              
              {/* Reject - for managers on pending_approval CPOs */}
              {canApprove && (
                <Button 
                  variant="destructive" 
                  onClick={() => { 
                    setApprovalAction('reject'); 
                    setApprovalDialogOpen(true); 
                  }}
                  disabled={isApproving}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              )}
              
              {/* Next stage actions - for confirmed CPOs */}
              {canProceedToNextStage && (
                <Button variant="outline" onClick={handleMaterialDemandPlanning} disabled={isCreatingMaterialDemand}>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  {isCreatingMaterialDemand ? 'Processing...' : 'Material Demand Planning'}
                </Button>
              )}
              
              {/* Cancel - for appropriate statuses */}
              {canCancel && (
                <Button variant="outline" className="text-destructive hover:text-destructive" onClick={handleCancel} disabled={isCancelling}>
                  <Ban className="h-4 w-4 mr-2" />
                  {isCancelling ? 'Cancelling...' : 'Cancel Order'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="items">Items & BOM</TabsTrigger>
          <TabsTrigger value="reservations">Reservations & Issues</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Customer Name</div>
                  <div className="font-medium">{cpo.customer?.customer_name || "-"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Customer Code</div>
                  <div className="font-medium">{cpo.customer?.customer_code || "-"}</div>
                </div>
                {cpo.customer?.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{cpo.customer.email}</span>
                  </div>
                )}
                {cpo.customer?.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{cpo.customer.phone}</span>
                  </div>
                )}
                {cpo.customer?.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>{cpo.customer.address}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Order Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">PO Date</div>
                  <div className="font-medium">
                    {cpo.po_date ? format(new Date(cpo.po_date), "MMMM dd, yyyy") : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Delivery Date</div>
                  <div className="font-medium">
                    {cpo.delivery_date ? format(new Date(cpo.delivery_date), "MMMM dd, yyyy") : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge variant="outline" className={getStatusColor(cpo.status)}>
                    {cpo.status?.replace(/_/g, ' ')}
                  </Badge>
                </div>
                {cpo.notes && (
                  <div>
                    <div className="text-sm text-muted-foreground">Notes</div>
                    <div className="text-sm">{cpo.notes}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Approval Information */}
          {cpo.approvals && cpo.approvals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Approval History</CardTitle>
                <CardDescription>Timeline of approvals and rejections</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cpo.approvals.map((approval: any) => (
                    <div key={approval.id} className="flex items-start gap-4 border-l-2 border-border pl-4 py-2">
                      <div className="mt-1">
                        {approval.action === 'approved' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{approval.approver?.full_name || "Unknown"}</span>
                          <Badge variant="outline" className={approval.action === 'approved' ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'}>
                            {approval.action}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(approval.created_at), "MMMM dd, yyyy 'at' hh:mm a")}
                        </div>
                        {approval.comments && (
                          <div className="text-sm mt-2 p-2 bg-muted rounded">
                            {approval.comments}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Workflow Progress */}
          {cpo.workflow && cpo.workflow.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Workflow Progress</CardTitle>
                <CardDescription>Track the progress through workflow stages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cpo.workflow.map((stage: any, index: number) => (
                    <div key={stage.id}>
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${stage.stage_completed_at ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                            {stage.stage_completed_at ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : (
                              <div className="h-2 w-2 rounded-full bg-current" />
                            )}
                          </div>
                          {index < cpo.workflow.length - 1 && (
                            <div className="w-0.5 h-12 bg-border mt-2" />
                          )}
                        </div>
                        <div className="flex-1 pb-8">
                          <div className="font-medium">{stage.workflow_stage}</div>
                          {stage.stage_completed_at && (
                            <div className="text-sm text-muted-foreground">
                              Completed {format(new Date(stage.stage_completed_at), "MMM dd, yyyy 'at' hh:mm a")}
                            </div>
                          )}
                          {stage.notes && (
                            <div className="text-sm text-muted-foreground mt-1">{stage.notes}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>Complete list of items in this purchase order</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={itemsColumns} data={cpo.items || []} />
              <Separator className="my-4" />
              <div className="flex justify-end">
                <div className="space-y-2 min-w-[200px]">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reservations Tab */}
        <TabsContent value="reservations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Reservations</CardTitle>
              <CardDescription>Materials reserved for this customer order</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={reservationsColumns} data={reservations} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Material Issue Notes</CardTitle>
              <CardDescription>Materials issued from warehouse for this order</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={materialIssuesColumns} data={materialIssues} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Complete audit trail of all stock movements</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={activityColumns} data={activityLog} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* CPO Approval Dialog */}
      <CpoApprovalDialog
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        onApprove={(comments) => handleApprovalSubmit('approved', comments)}
        onReject={(comments) => handleApprovalSubmit('rejected', comments)}
        isLoading={isApproving}
        action={approvalAction}
        cpoNumber={cpo?.cpo_number || ''}
      />
    </div>
  );
}
