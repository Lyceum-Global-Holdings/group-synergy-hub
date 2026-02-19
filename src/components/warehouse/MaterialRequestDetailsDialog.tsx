import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, FileText, Send, Package, RotateCcw } from "lucide-react";
import { MaterialRequest, MaterialRequestStatus, MaterialRequestPriority } from "@/types/materialIssueReturn";
import { useMaterialRequestItems } from "@/hooks/useMaterialRequestItems";
import { format } from "date-fns";
import { useState } from "react";
import { ConvertToIssueDialog } from "./ConvertToIssueDialog";
import { MarkItemsReceivedDialog } from "./MarkItemsReceivedDialog";
import { AdjustRequestQuantitiesDialog } from "./AdjustRequestQuantitiesDialog";
import { CreateMaterialReturnDialog } from "./CreateMaterialReturnDialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useMaterialRequests } from "@/hooks/useMaterialRequests";
import { useQueryClient } from "@tanstack/react-query";

interface MaterialRequestDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: MaterialRequest | null;
}

const getStatusColor = (status: MaterialRequestStatus): "default" | "destructive" | "outline" | "secondary" => {
  const colors: Record<MaterialRequestStatus, "default" | "destructive" | "outline" | "secondary"> = {
    draft: "secondary",
    pending_hod_approval: "default",
    pending_management_approval: "default",
    approved: "default",
    rejected: "destructive",
    issued: "default",
    partially_received: "secondary",
    completed: "default",
    cancelled: "secondary",
  };
  return colors[status];
};

const getPriorityColor = (priority: MaterialRequestPriority): "default" | "destructive" | "outline" | "secondary" => {
  const colors: Record<MaterialRequestPriority, "default" | "destructive" | "outline" | "secondary"> = {
    urgent: "destructive",
    high: "default",
    medium: "default",
    low: "secondary",
  };
  return colors[priority];
};

export function MaterialRequestDetailsDialog({ open, onOpenChange, request }: MaterialRequestDetailsDialogProps) {
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [comments, setComments] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const { requestItems } = useMaterialRequestItems(request?.id);
  const { hodApprove, managementApprove, rejectRequest, submitForApproval, isHodApproving, isManagementApproving, isRejecting, isSubmitting } = useMaterialRequests();

  if (!request) return null;

  const handleHODApprove = () => {
    // In a real app, you'd check if management approval is needed based on business rules
    const requiresManagementApproval = false; // Simplified for now
    hodApprove({ id: request.id, comments, requiresManagementApproval });
    setComments("");
  };

  const handleManagementApprove = () => {
    managementApprove({ id: request.id, comments });
    setComments("");
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      return;
    }
    rejectRequest({ id: request.id, reason: rejectionReason });
    setRejectionReason("");
  };

  const canSubmit = request.status === 'draft';
  const canApproveHOD = request.status === 'pending_hod_approval';
  const canApproveManagement = request.status === 'pending_management_approval';
  const canConvertToIssue = request.status === 'approved';
  const canReject = request.status === 'pending_hod_approval' || request.status === 'pending_management_approval';
  const canReceive = (request.status === 'issued' || request.status === 'partially_received') && request.min_id;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Material Request: {request.request_number}</DialogTitle>
              <div className="flex gap-2">
                <Badge variant={getStatusColor(request.status)}>{request.status}</Badge>
                <Badge variant={getPriorityColor(request.priority)}>{request.priority}</Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Request Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Request Information</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Request Date:</span>
                    <span>{format(new Date(request.request_date), 'PPP')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date Required:</span>
                    <span>{format(new Date(request.items_required_date), 'PPP')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requested By:</span>
                    <span>{request.requested_by}</span>
                  </div>
                  {(request as any).warehouse_locations?.name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location:</span>
                      <span>{(request as any).warehouse_locations.name}</span>
                    </div>
                  )}
                  {request.job_number && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Job Number:</span>
                      <span>{request.job_number}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Contact Information</h3>
                <div className="space-y-1 text-sm">
                  {request.contact_number && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contact:</span>
                      <span>{request.contact_number}</span>
                    </div>
                  )}
                  {request.epf_number && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">EPF Number:</span>
                      <span>{request.epf_number}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Purpose</h3>
              <p className="text-sm">{request.purpose}</p>
              {request.notes && (
                <>
                  <h3 className="font-semibold mt-2 mb-1">Notes</h3>
                  <p className="text-sm text-muted-foreground">{request.notes}</p>
                </>
              )}
            </div>

            <Separator />

            {/* Items Table */}
            <div>
              <h3 className="font-semibold mb-2">Requested Items</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Qty Requested</TableHead>
                    {request.status !== 'draft' && <TableHead>Qty Approved</TableHead>}
                    <TableHead>UOM</TableHead>
                    <TableHead>Purpose</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requestItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.item_code}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.quantity_requested}</TableCell>
                      {request.status !== 'draft' && (
                        <TableCell>{item.quantity_approved || item.quantity_requested}</TableCell>
                      )}
                      <TableCell>{item.unit_of_measure}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.purpose}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Approval Timeline */}
            {(request.hod_approved_by || request.management_approved_by || request.rejection_reason) && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Approval Timeline</h3>
                  <div className="space-y-2 text-sm">
                    {request.hod_approved_by && (
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <div>
                          <div className="font-medium">HOD Approved</div>
                          <div className="text-muted-foreground">
                            {request.hod_approval_date && format(new Date(request.hod_approval_date), 'PPP')}
                          </div>
                          {request.hod_comments && (
                            <div className="text-muted-foreground italic">"{request.hod_comments}"</div>
                          )}
                        </div>
                      </div>
                    )}
                    {request.management_approved_by && (
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <div>
                          <div className="font-medium">Management Approved</div>
                          <div className="text-muted-foreground">
                            {request.management_approval_date && format(new Date(request.management_approval_date), 'PPP')}
                          </div>
                          {request.management_comments && (
                            <div className="text-muted-foreground italic">"{request.management_comments}"</div>
                          )}
                        </div>
                      </div>
                    )}
                    {request.rejection_reason && (
                      <div className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                        <div>
                          <div className="font-medium text-destructive">Rejected</div>
                          <div className="text-muted-foreground italic">"{request.rejection_reason}"</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Approval Actions */}
            {(canApproveHOD || canApproveManagement || canReject) && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="comments">Comments</Label>
                    <Textarea
                      id="comments"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Add your comments (optional)"
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    {canReject && (
                      <div className="flex-1 flex gap-2">
                        <Textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Rejection reason (required)"
                          rows={2}
                          className="flex-1"
                        />
                        <Button
                          variant="destructive"
                          onClick={handleReject}
                          disabled={!rejectionReason.trim() || isRejecting}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    )}
                    {canApproveHOD && (
                      <Button onClick={handleHODApprove} disabled={isHodApproving}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        HOD Approve
                      </Button>
                    )}
                    {canApproveManagement && (
                      <Button onClick={handleManagementApprove} disabled={isManagementApproving}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Management Approve
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Submit / Issue / Receive Actions */}
            {(canSubmit || canConvertToIssue || canReceive) && (
              <>
                <Separator />
                <div className="flex justify-end gap-2">
                  {canSubmit && (
                    <Button onClick={() => submitForApproval(request.id)} disabled={isSubmitting}>
                      <Send className="mr-2 h-4 w-4" />
                      Submit for Approval
                    </Button>
                  )}
                  {canConvertToIssue && !request.min_id && (
                    <Button onClick={() => setShowConvertDialog(true)}>
                      <FileText className="mr-2 h-4 w-4" />
                      Issue Materials
                    </Button>
                  )}
                  {canReceive && (
                    <Button onClick={() => setShowReceiveDialog(true)}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark Items Received
                    </Button>
                  )}
                </div>
              </>
            )}

            {request.min_id && request.status === 'completed' && (
              <div className="bg-muted p-4 rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Materials have been issued and received for this request</span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {requestItems && (
        <>
          <ConvertToIssueDialog
            open={showConvertDialog}
            onOpenChange={setShowConvertDialog}
            request={request}
            items={requestItems}
          />
          <MarkItemsReceivedDialog
            open={showReceiveDialog}
            onOpenChange={setShowReceiveDialog}
            requestId={request.id}
            items={requestItems}
            onSuccess={() => {
              setShowReceiveDialog(false);
            }}
          />
          <AdjustRequestQuantitiesDialog
            open={showAdjustDialog}
            onOpenChange={setShowAdjustDialog}
            request={request}
            items={requestItems}
            onSuccess={() => {
              setShowAdjustDialog(false);
            }}
          />
        </>
      )}
    </>
  );
}
