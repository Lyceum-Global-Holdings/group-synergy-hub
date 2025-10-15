import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetRequest } from "@/types/assetRequest";
import { useAssetRequests } from "@/hooks/useAssetRequests";
import { Loader2, FileText, CheckCircle, XCircle, Clock, Package, History } from "lucide-react";
import { format } from "date-fns";
import { WorkflowHistoryTimeline } from "./WorkflowHistoryTimeline";
import { DeliveryDialog } from "./DeliveryDialog";
import { ReceiptConfirmationDialog } from "./ReceiptConfirmationDialog";
import { useCurrentUserRoles } from "@/hooks/useCurrentUserRoles";

interface AssetRequestDetailsDialogProps {
  request: AssetRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
  canApprove?: boolean;
}

export function AssetRequestDetailsDialog({
  request,
  open,
  onOpenChange,
  onApprove,
  onReject,
  canApprove = false,
}: AssetRequestDetailsDialogProps) {
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  
  const { useAssetRequestItems, useWorkflowHistory, useRequestDeliveries } = useAssetRequests();
  const { data: items = [], isLoading: itemsLoading } = useAssetRequestItems(request?.id);
  const { data: workflowHistory = [] } = useWorkflowHistory(request?.id);
  const { data: deliveries = [] } = useRequestDeliveries(request?.id);
  const { data: userRoles = [] } = useCurrentUserRoles();

  if (!request) return null;

  const hasAnyRole = (roles: string[]) => {
    return userRoles.some((ur: any) => roles.includes(ur.role));
  };

  const canMarkAsDelivered = request.status === 'approved' && hasAnyRole(['procurement', 'admin']);
  const canConfirmReceipt = request.status === 'pending_receipt';
  const latestDelivery = deliveries[0];

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "bg-muted text-muted-foreground",
      pending_hod_approval: "bg-warning/10 text-warning border-warning/20",
      pending_procurement_approval: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      approved: "bg-success/10 text-success border-success/20",
      rejected: "bg-destructive/10 text-destructive border-destructive/20",
      fulfilled: "bg-success/20 text-success border-success/30",
      partially_fulfilled: "bg-warning/10 text-warning border-warning/20",
      cancelled: "bg-muted text-muted-foreground",
      pending_delivery: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      pending_receipt: "bg-warning/10 text-warning border-warning/20",
    };
    return variants[status as keyof typeof variants] || variants.draft;
  };

  const getPriorityBadge = (priority: string) => {
    const variants = {
      low: "bg-muted text-muted-foreground",
      medium: "bg-blue-500/10 text-blue-500",
      high: "bg-warning/10 text-warning",
      urgent: "bg-destructive/10 text-destructive",
    };
    return variants[priority as keyof typeof variants] || variants.medium;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-2xl">
                  Request #{request.request_number}
                </DialogTitle>
                <DialogDescription>
                  Created on {format(new Date(request.created_at), "PPP")}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <Badge className={getStatusBadge(request.status)} variant="outline">
                  {request.status.replace(/_/g, " ").toUpperCase()}
                </Badge>
                <Badge className={getPriorityBadge(request.priority)} variant="outline">
                  {request.priority.toUpperCase()}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">
                <FileText className="h-4 w-4 mr-2" />
                Details
              </TabsTrigger>
              <TabsTrigger value="items">
                <Package className="h-4 w-4 mr-2" />
                Items ({items.length})
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-4 w-4 mr-2" />
                Workflow History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-6">
              {/* Request Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Requester</p>
                  <p className="font-medium">{request.requester_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{request.department || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="font-medium">{request.contact_number || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Required Date</p>
                  <p className="font-medium">
                    {format(new Date(request.required_date), "PPP")}
                  </p>
                </div>
              </div>

              {/* Purpose & Justification */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Purpose</p>
                <p className="text-sm bg-muted p-3 rounded-lg">{request.purpose}</p>
              </div>

              {request.justification && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Business Justification
                  </p>
                  <p className="text-sm bg-muted p-3 rounded-lg">
                    {request.justification}
                  </p>
                </div>
              )}

              {/* Approval Status */}
              {request.status !== "draft" && (
                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3">Approval Timeline</h3>
                  <div className="space-y-3">
                    {request.hod_approved_by && (
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                        <div>
                          <p className="font-medium">HOD Approved</p>
                          <p className="text-sm text-muted-foreground">
                            {request.hod_approval_date &&
                              format(new Date(request.hod_approval_date), "PPp")}
                          </p>
                          {request.hod_comments && (
                            <p className="text-sm mt-1 italic">{request.hod_comments}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {request.procurement_approved_by && (
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-success mt-0.5" />
                        <div>
                          <p className="font-medium">Procurement Approved</p>
                          <p className="text-sm text-muted-foreground">
                            {request.procurement_approval_date &&
                              format(new Date(request.procurement_approval_date), "PPp")}
                          </p>
                          {request.procurement_comments && (
                            <p className="text-sm mt-1 italic">
                              {request.procurement_comments}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {request.status === "rejected" && request.rejection_reason && (
                      <div className="flex items-start gap-3">
                        <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                        <div>
                          <p className="font-medium">Rejected</p>
                          <p className="text-sm mt-1 italic">{request.rejection_reason}</p>
                        </div>
                      </div>
                    )}

                    {request.status.includes("pending") && (
                      <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 text-warning mt-0.5" />
                        <div>
                          <p className="font-medium">Pending Approval</p>
                          <p className="text-sm text-muted-foreground">
                            Awaiting {request.status.replace("pending_", "").replace("_", " ")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {request.notes && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-1">Additional Notes</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{request.notes}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="items" className="space-y-4 mt-6">
              {itemsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead>Approved</TableHead>
                        <TableHead>Fulfilled</TableHead>
                        <TableHead>Est. Total</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.item_name}</p>
                              {item.brand && (
                                <p className="text-sm text-muted-foreground">
                                  {item.brand}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {item.request_type === "from_master"
                                ? "From Master"
                                : "New Item"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{item.quantity_requested}</TableCell>
                          <TableCell className="font-medium text-blue-600">
                            {item.quantity_approved || "—"}
                          </TableCell>
                          <TableCell className="font-medium text-success">
                            {item.quantity_fulfilled || 0}
                          </TableCell>
                          <TableCell>
                            {item.total_price_estimate
                              ? `LKR ${item.total_price_estimate.toLocaleString()}`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex justify-end">
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Total Estimated Cost
                      </p>
                      <p className="text-2xl font-bold">
                        LKR {request.total_estimated_cost?.toLocaleString() || 0}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <WorkflowHistoryTimeline history={workflowHistory} />
            </TabsContent>
          </Tabs>

          {/* Action Buttons Footer */}
          <div className="border-t pt-4 flex justify-between gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>

            <div className="flex gap-2">
              {canApprove && request.status.includes("pending") && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => onReject?.(request.id)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button onClick={() => onApprove?.(request.id)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </>
              )}

              {canMarkAsDelivered && (
                <Button onClick={() => setDeliveryDialogOpen(true)}>
                  <Package className="h-4 w-4 mr-2" />
                  Mark as Delivered
                </Button>
              )}

              {canConfirmReceipt && (
                <Button onClick={() => setReceiptDialogOpen(true)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Receipt
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delivery Dialog */}
      <DeliveryDialog
        request={request}
        open={deliveryDialogOpen}
        onOpenChange={setDeliveryDialogOpen}
      />

      {/* Receipt Confirmation Dialog */}
      <ReceiptConfirmationDialog
        request={request}
        delivery={latestDelivery}
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
      />
    </>
  );
}
