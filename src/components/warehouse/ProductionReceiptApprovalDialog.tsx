import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useFinishedGoodsBatches, FinishedGoodsBatch } from "@/hooks/useFinishedGoodsBatches";
import { useFinishedGoods } from "@/hooks/useFinishedGoods";
import { useIsAdmin } from "@/hooks/useSuperAdmin";
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface ProductionReceiptApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: FinishedGoodsBatch | null;
}

export function ProductionReceiptApprovalDialog({
  open,
  onOpenChange,
  batch,
}: ProductionReceiptApprovalDialogProps) {
  const [comments, setComments] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const { approveBatch, rejectBatch, isApproving, isRejecting } = useFinishedGoodsBatches();
  const { products } = useFinishedGoods();
  const { data: isAdmin } = useIsAdmin();

  if (!batch) return null;

  const finishedGood = products?.find(p => p.id === batch.finished_good_id);

  const handleApprove = () => {
    approveBatch(
      { id: batch.id, comments },
      {
        onSuccess: () => {
          setComments("");
          onOpenChange(false);
        },
      }
    );
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      return;
    }
    rejectBatch(
      { id: batch.id, reason: rejectionReason },
      {
        onSuccess: () => {
          setRejectionReason("");
          onOpenChange(false);
        },
      }
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getQualityBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return <Badge variant="default" className="bg-green-600">Passed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Production Receipt Details</DialogTitle>
          <DialogDescription>
            Review and approve or reject this production receipt
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div>
              <p className="text-sm text-muted-foreground">Approval Status</p>
              <div className="mt-1">{getStatusBadge(batch.approval_status)}</div>
            </div>
            {batch.approval_status === 'rejected' && batch.rejection_reason && (
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Rejected:</p>
                  <p>{batch.rejection_reason}</p>
                </div>
              </div>
            )}
          </div>

          {/* Batch Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Batch Number</Label>
              <p className="font-medium">{batch.batch_number}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Production Date</Label>
              <p className="font-medium">{format(new Date(batch.production_date), 'PPP')}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Finished Good</Label>
              <p className="font-medium">{finishedGood?.product_name || 'Unknown'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Quantity</Label>
              <p className="font-medium">{batch.quantity} units</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Production Cost</Label>
              <p className="font-medium">LKR {batch.production_cost?.toLocaleString() || '0'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Quality Status</Label>
              <div className="mt-1">{getQualityBadge(batch.quality_check_status)}</div>
            </div>
            {batch.expiry_date && (
              <div>
                <Label className="text-muted-foreground">Expiry Date</Label>
                <p className="font-medium">{format(new Date(batch.expiry_date), 'PPP')}</p>
              </div>
            )}
          </div>

          {/* Notes */}
          {batch.notes && (
            <div>
              <Label className="text-muted-foreground">Notes</Label>
              <p className="text-sm mt-1 p-3 bg-muted rounded-md">{batch.notes}</p>
            </div>
          )}

          {/* Approval/Rejection Actions - Only show for pending batches and admins */}
          {batch.approval_status === 'pending' && isAdmin && (
            <>
              <div>
                <Label htmlFor="comments">Approval Comments (Optional)</Label>
                <Textarea
                  id="comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Add any comments about this approval..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="rejection">Rejection Reason (Required for rejection)</Label>
                <Textarea
                  id="rejection"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this batch is being rejected..."
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Approval History */}
          {(batch.approval_status === 'approved' || batch.approval_status === 'rejected') && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <Label className="text-muted-foreground">Approval History</Label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span>Created on {format(new Date(batch.created_at), 'PPP')}</span>
                </div>
                {batch.approved_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${batch.approval_status === 'approved' ? 'bg-green-600' : 'bg-destructive'}`}></div>
                    <span>
                      {batch.approval_status === 'approved' ? 'Approved' : 'Rejected'} on {format(new Date(batch.approved_date), 'PPP')}
                    </span>
                  </div>
                )}
                {batch.approval_comments && (
                  <p className="text-sm text-muted-foreground ml-4">
                    Comment: {batch.approval_comments}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {batch.approval_status === 'pending' && isAdmin && (
            <>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isRejecting || !rejectionReason.trim()}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button onClick={handleApprove} disabled={isApproving}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
