import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AssetRequestWithItems } from "@/types/assetRequest";
import { useAssetRequests } from "@/hooks/useAssetRequests";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { CheckCircle2, XCircle, ShoppingCart, Truck, Package, ThumbsUp } from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

interface AssetRequestDetailsDialogProps {
  request: AssetRequestWithItems;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AssetRequestDetailsDialog = ({ request, open, onOpenChange }: AssetRequestDetailsDialogProps) => {
  const { toast } = useToast();
  const { 
    hodApprove, 
    isHodApproving,
    hodReject, 
    isHodRejecting,
    confirmPurchase,
    isConfirmingPurchase,
    markAsDelivered,
    isMarkingDelivered,
    confirmReceipt,
    isConfirmingReceipt
  } = useAssetRequests();
  const [comments, setComments] = useState("");

  const statusConfig: Record<string, { variant: any; label: string }> = {
    draft: { variant: "outline", label: "Draft" },
    pending_hod_approval: { variant: "secondary", label: "Pending HOD Approval" },
    pending_procurement_approval: { variant: "secondary", label: "Pending Procurement" },
    approved: { variant: "default", label: "Approved" },
    purchased: { variant: "default", label: "Purchased" },
    pending_delivery: { variant: "outline", label: "Pending Delivery" },
    pending_receipt: { variant: "outline", label: "Pending Receipt" },
    fulfilled: { variant: "default", label: "Fulfilled" },
    partially_fulfilled: { variant: "secondary", label: "Partially Fulfilled" },
    rejected: { variant: "destructive", label: "Rejected" },
    cancelled: { variant: "destructive", label: "Cancelled" },
    returned: { variant: "destructive", label: "Returned" },
    partially_returned: { variant: "destructive", label: "Partially Returned" },
  };

  const handleApprove = () => {
    // Auto-approve all items with their requested quantities
    const itemApprovals = request.asset_request_items?.map(item => ({
      item_id: item.id,
      quantity_approved: item.quantity_requested
    })) || [];

    hodApprove(
      { 
        id: request.id, 
        comments,
        itemApprovals
      },
      {
        onSuccess: () => {
          toast({ title: "Success", description: "Request approved successfully" });
          onOpenChange(false);
        }
      }
    );
  };

  const handleReject = () => {
    if (!comments) {
      toast({
        title: "Validation Error",
        description: "Please provide rejection reason",
        variant: "destructive"
      });
      return;
    }
    
    hodReject(
      { id: request.id, reason: comments },
      {
        onSuccess: () => {
          toast({ title: "Success", description: "Request rejected" });
          onOpenChange(false);
        }
      }
    );
  };

  const handleMarkPurchased = () => {
    // Auto-fulfill all items with their approved quantities
    const itemPurchases = request.asset_request_items?.map(item => ({
      item_id: item.id,
      quantity: item.quantity_approved || item.quantity_requested,
      unit_price: item.unit_price_estimate
    })) || [];

    confirmPurchase(
      { 
        id: request.id, 
        purchased_date: new Date().toISOString().split('T')[0],
        purchase_notes: comments,
        itemPurchases
      },
      {
        onSuccess: () => {
          toast({ title: "Success", description: "Marked as purchased" });
          onOpenChange(false);
        }
      }
    );
  };

  const handleMarkDelivered = () => {
    markAsDelivered(
      { id: request.id },
      {
        onSuccess: () => {
          toast({ title: "Success", description: "Marked as delivered" });
          onOpenChange(false);
        }
      }
    );
  };

  const handleAcceptReceipt = () => {
    confirmReceipt(
      { id: request.id },
      {
        onSuccess: () => {
          toast({ title: "Success", description: "Receipt accepted, request fulfilled" });
          onOpenChange(false);
        }
      }
    );
  };

  const totalEstimatedCost = request.asset_request_items?.reduce((sum, item) => sum + (item.total_price_estimate || 0), 0) || 0;

  const status = statusConfig[request.status] || { variant: "outline", label: request.status };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Asset Request: {request.request_number}</DialogTitle>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Request Information */}
          <Card>
            <CardHeader>
              <CardTitle>Request Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Requester</p>
                  <p className="font-medium">{request.requester_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{request.department || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="font-medium">{request.contact_number || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Request Date</p>
                  <p className="font-medium">{format(new Date(request.request_date), "MMM dd, yyyy")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Required Date</p>
                  <p className="font-medium">{format(new Date(request.required_date), "MMM dd, yyyy")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Priority</p>
                  <Badge variant={request.priority === "urgent" ? "destructive" : "outline"}>
                    {request.priority.toUpperCase()}
                  </Badge>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">Purpose</p>
                <p className="text-sm">{request.purpose}</p>
              </div>
              
              {request.justification && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Justification</p>
                  <p className="text-sm">{request.justification}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Request Items */}
          <Card>
            <CardHeader>
              <CardTitle>Requested Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead className="text-right">Qty Requested</TableHead>
                    <TableHead className="text-right">Qty Approved</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {request.asset_request_items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.item_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.request_type === "from_master" ? "From Master" : "New Item"}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.brand || "N/A"}</TableCell>
                      <TableCell className="text-right">{item.quantity_requested}</TableCell>
                      <TableCell className="text-right">{item.quantity_approved || "-"}</TableCell>
                      <TableCell className="text-right">
                        {item.unit_price_estimate ? `LKR ${item.unit_price_estimate.toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.total_price_estimate ? `LKR ${item.total_price_estimate.toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="flex justify-end mt-4 pt-4 border-t">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Estimated Cost</p>
                  <p className="text-lg font-bold">LKR {totalEstimatedCost.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Approval History */}
          {(request.hod_approval_date || request.procurement_approval_date) && (
            <Card>
              <CardHeader>
                <CardTitle>Approval History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {request.hod_approval_date && (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium">HOD Approved</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(request.hod_approval_date), "MMM dd, yyyy HH:mm")}
                      </p>
                      {request.hod_comments && (
                        <p className="text-sm mt-1">{request.hod_comments}</p>
                      )}
                    </div>
                  </div>
                )}
                
                {request.procurement_approval_date && (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Procurement Approved</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(request.procurement_approval_date), "MMM dd, yyyy HH:mm")}
                      </p>
                      {request.procurement_comments && (
                        <p className="text-sm mt-1">{request.procurement_comments}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Panel */}
          {request.status !== "fulfilled" && request.status !== "cancelled" && request.status !== "rejected" && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="comments">Comments/Notes</Label>
                  <Textarea
                    id="comments"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Enter comments or notes..."
                    rows={3}
                  />
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {request.status === "pending_hod_approval" && (
                    <>
                      <Button onClick={handleApprove} disabled={isHodApproving}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve (HOD)
                      </Button>
                      <Button variant="destructive" onClick={handleReject} disabled={isHodRejecting}>
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </>
                  )}
                  
                  {request.status === "approved" && (
                    <Button onClick={handleMarkPurchased} disabled={isConfirmingPurchase}>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Mark as Purchased
                    </Button>
                  )}
                  
                  {request.status === "purchased" && (
                    <Button onClick={handleMarkDelivered} disabled={isMarkingDelivered}>
                      <Truck className="h-4 w-4 mr-2" />
                      Mark as Delivered
                    </Button>
                  )}
                  
                  {request.status === "pending_receipt" && (
                    <Button onClick={handleAcceptReceipt} disabled={isConfirmingReceipt}>
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      Accept Receipt
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};