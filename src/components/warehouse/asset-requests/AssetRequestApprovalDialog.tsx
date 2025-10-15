import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAssetRequests } from "@/hooks/useAssetRequests";
import { ApprovalLevel, ApprovalAction, AssetRequest } from "@/types/assetRequest";
import { Loader2, AlertTriangle, CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import { format } from "date-fns";

interface AssetRequestApprovalDialogProps {
  requestId: string | null;
  request: AssetRequest | null;
  approvalLevel: ApprovalLevel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprovalComplete?: (level: ApprovalLevel, action: ApprovalAction) => void;
}

export function AssetRequestApprovalDialog({
  requestId,
  request,
  approvalLevel,
  open,
  onOpenChange,
  onApprovalComplete,
}: AssetRequestApprovalDialogProps) {
  const [comments, setComments] = useState("");
  const [itemAdjustments, setItemAdjustments] = useState<Record<string, number>>({});
  const { approveAssetRequest, isApproving, useAssetRequestItems } = useAssetRequests();
  const { data: items = [] } = useAssetRequestItems(requestId || undefined);

  useEffect(() => {
    if (open && items.length > 0) {
      // Initialize adjustments with requested quantities
      const initial = items.reduce((acc, item) => ({
        ...acc,
        [item.id]: item.quantity_requested
      }), {});
      setItemAdjustments(initial);
    }
  }, [open, items]);

  const handleSubmit = (selectedAction: ApprovalAction) => {
    if (!requestId) return;

    approveAssetRequest(
      {
        request_id: requestId,
        approval_level: approvalLevel,
        action: selectedAction,
        comments: comments || undefined,
        item_adjustments: approvalLevel === 'procurement' ? itemAdjustments : undefined,
      },
      {
        onSuccess: () => {
          setComments("");
          setItemAdjustments({});
          onOpenChange(false);
          onApprovalComplete?.(approvalLevel, selectedAction);
        },
      }
    );
  };

  const handleAdjustQuantity = (itemId: string, newQuantity: number) => {
    setItemAdjustments(prev => ({
      ...prev,
      [itemId]: Math.max(0, newQuantity)
    }));
  };

  const getTotalAdjustedCost = () => {
    return items.reduce((total, item) => {
      const adjustedQty = itemAdjustments[item.id] || 0;
      return total + (adjustedQty * (item.unit_price_estimate || 0));
    }, 0);
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">
                {approvalLevel === "hod"
                  ? "HOD Approval Required"
                  : "Procurement Approval Required"}
              </DialogTitle>
              <DialogDescription>
                Review request details and make approval decision
              </DialogDescription>
            </div>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
              {approvalLevel === "hod" ? "HOD Review" : "Procurement Review"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Request Overview */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Request Number</p>
              <p className="font-mono font-medium">{request.request_number}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Requester</p>
              <p className="font-medium">{request.requester_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Department</p>
              <p className="font-medium">{request.department || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Required Date</p>
              <p className="font-medium text-warning">
                {format(new Date(request.required_date), "PPP")}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground mb-1">Purpose</p>
              <p className="text-sm bg-background p-2 rounded border">
                {request.purpose}
              </p>
            </div>
            {request.justification && (
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground mb-1">Justification</p>
                <p className="text-sm bg-background p-2 rounded border">
                  {request.justification}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Requested Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Requested Items
              </h3>
              <Badge variant="outline">{items.length} items</Badge>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Requested Qty</TableHead>
                    {approvalLevel === "procurement" && (
                      <TableHead>Approved Qty</TableHead>
                    )}
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const adjustedQty = itemAdjustments[item.id] || item.quantity_requested;
                    const itemTotal = adjustedQty * (item.unit_price_estimate || 0);
                    const hasAdjustment = adjustedQty !== item.quantity_requested;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.item_name}</p>
                            {item.brand && (
                              <p className="text-sm text-muted-foreground">{item.brand}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {item.request_type === "from_master" ? "From Master" : "New Item"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.quantity_requested}
                        </TableCell>
                        {approvalLevel === "procurement" && (
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={adjustedQty}
                              onChange={(e) => handleAdjustQuantity(item.id, parseInt(e.target.value) || 0)}
                              className={`w-24 ${hasAdjustment ? 'border-warning' : ''}`}
                            />
                            {hasAdjustment && (
                              <p className="text-xs text-warning mt-1">Adjusted</p>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          {item.unit_price_estimate
                            ? `LKR ${item.unit_price_estimate.toLocaleString()}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              LKR {itemTotal.toLocaleString()}
                            </p>
                            {hasAdjustment && (
                              <p className="text-xs text-muted-foreground line-through">
                                {(item.quantity_requested * (item.unit_price_estimate || 0)).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex justify-end">
              <div className="bg-muted p-4 rounded-lg min-w-[250px]">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Requested Total:</span>
                    <span className="line-through">
                      LKR {request.total_estimated_cost?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Approved Total:</span>
                    <span className="text-primary">
                      LKR {getTotalAdjustedCost().toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Approval Decision */}
          <div>
            <Label htmlFor="approval-comments" className="text-base font-semibold">
              {approvalLevel === "hod" ? "HOD Comments" : "Procurement Comments"}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (Optional but recommended for rejections or changes)
              </span>
            </Label>
            <Textarea
              id="approval-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={`Add your ${approvalLevel === "hod" ? "HOD" : "procurement"} review comments...`}
              rows={4}
              className="mt-2"
            />
          </div>

          {/* Approval Warning */}
          {approvalLevel === "hod" && (
            <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-medium text-blue-500">HOD Approval</p>
                <p className="text-sm text-muted-foreground">
                  After HOD approval, this request will be forwarded to Procurement for final review and fulfillment planning.
                </p>
              </div>
            </div>
          )}

          {approvalLevel === "procurement" && (
            <div className="flex items-start gap-3 p-4 bg-success/10 border border-success/20 rounded-lg">
              <CheckCircle className="h-5 w-5 text-success mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-medium text-success">Final Approval</p>
                <p className="text-sm text-muted-foreground">
                  Procurement approval will mark this request as ready for fulfillment. You can adjust quantities if needed.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isApproving}
            >
              Cancel
            </Button>
            
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => handleSubmit("rejected")}
                disabled={isApproving}
              >
                {isApproving && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <XCircle className="h-4 w-4 mr-2" />
                Reject Request
              </Button>
              
              <Button
                variant="outline"
                onClick={() => handleSubmit("requested_changes")}
                disabled={isApproving}
              >
                {isApproving && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <Clock className="h-4 w-4 mr-2" />
                Request Changes
              </Button>
              
              <Button
                onClick={() => handleSubmit("approved")}
                disabled={isApproving}
                className="min-w-[140px]"
              >
                {isApproving && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
