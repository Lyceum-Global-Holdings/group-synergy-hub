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
import { AssetRequest } from "@/types/assetRequest";
import { useAssetRequests } from "@/hooks/useAssetRequests";
import { Loader2, FileText, CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";

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
  const { useAssetRequestItems } = useAssetRequests();
  const { data: items = [], isLoading: itemsLoading } = useAssetRequestItems(request?.id);

  if (!request) return null;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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

        <div className="space-y-6">
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

          {/* Items Table */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Requested Items</h3>
            {itemsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Est. Unit Price</TableHead>
                    <TableHead>Total</TableHead>
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
                        <Badge variant="outline">
                          {item.request_type === "from_master"
                            ? "From Master"
                            : "New Item"}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.quantity_requested}</TableCell>
                      <TableCell>
                        {item.unit_price_estimate
                          ? `LKR ${item.unit_price_estimate.toLocaleString()}`
                          : "—"}
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
            )}

            <div className="mt-4 flex justify-end">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Total Estimated Cost
                </p>
                <p className="text-2xl font-bold">
                  LKR {request.total_estimated_cost?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {request.notes && (
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-1">Additional Notes</p>
              <p className="text-sm bg-muted p-3 rounded-lg">{request.notes}</p>
            </div>
          )}

          {/* Action Buttons */}
          {canApprove && request.status.includes("pending") && (
            <div className="border-t pt-4 flex justify-end gap-2">
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
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
