import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  useStockTransferItems,
  useUpdateStockTransfer,
  useApproveStockTransfer,
  useCompleteStockTransfer,
  useDeleteStockTransfer,
} from "@/hooks/useStockTransfer";
import type { StockTransferRequest } from "@/types/stockTransfer";
import { format } from "date-fns";
import { 
  CheckCircle, 
  XCircle, 
  Truck, 
  Trash2,
  ArrowRight,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StockTransferDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer: StockTransferRequest;
}

export function StockTransferDetailsDialog({
  open,
  onOpenChange,
  transfer,
}: StockTransferDetailsDialogProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: items = [] } = useStockTransferItems(transfer.id);
  const updateTransfer = useUpdateStockTransfer();
  const approveTransfer = useApproveStockTransfer();
  const completeTransfer = useCompleteStockTransfer();
  const deleteTransfer = useDeleteStockTransfer();

  const handleSubmitForApproval = async () => {
    await updateTransfer.mutateAsync({
      id: transfer.id,
      data: { status: "pending_approval" },
    });
  };

  const handleApprove = async () => {
    await approveTransfer.mutateAsync(transfer.id);
  };

  const handleStartTransfer = async () => {
    await updateTransfer.mutateAsync({
      id: transfer.id,
      data: { status: "in_transit" },
    });
  };

  const handleComplete = async () => {
    await completeTransfer.mutateAsync(transfer.id);
    onOpenChange(false);
  };

  const handleCancel = async () => {
    await updateTransfer.mutateAsync({
      id: transfer.id,
      data: { status: "cancelled" },
    });
  };

  const handleDelete = async () => {
    await deleteTransfer.mutateAsync(transfer.id);
    setShowDeleteConfirm(false);
    onOpenChange(false);
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Transfer Details: {transfer.transfer_number}</DialogTitle>
              {getStatusBadge(transfer.status)}
            </div>
            <DialogDescription>
              Created on {format(new Date(transfer.created_at), "PPP")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="font-semibold">Transfer Information</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Transfer Date:</span> {format(new Date(transfer.transfer_date), "PPP")}</p>
                  <p><span className="text-muted-foreground">Type:</span> {transfer.transfer_type}</p>
                  <p><span className="text-muted-foreground">Priority:</span> <span className="font-medium">{transfer.priority.toUpperCase()}</span></p>
                  {transfer.expected_completion_date && (
                    <p><span className="text-muted-foreground">Expected Completion:</span> {format(new Date(transfer.expected_completion_date), "PPP")}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Status Tracking</h3>
                <div className="space-y-1 text-sm">
                  {transfer.requested_date && (
                    <p><span className="text-muted-foreground">Requested:</span> {format(new Date(transfer.requested_date), "PPP")}</p>
                  )}
                  {transfer.approved_date && (
                    <p><span className="text-muted-foreground">Approved:</span> {format(new Date(transfer.approved_date), "PPP")}</p>
                  )}
                  {transfer.completed_date && (
                    <p><span className="text-muted-foreground">Completed:</span> {format(new Date(transfer.completed_date), "PPP")}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">From</p>
                <p className="font-medium">
                  {transfer.from_location?.name || transfer.from_department?.name || "Not specified"}
                </p>
                {transfer.from_sublocation?.name && (
                  <p className="text-xs text-muted-foreground">{transfer.from_sublocation.name}</p>
                )}
                {transfer.from_department?.name && transfer.from_location?.name && (
                  <p className="text-xs text-muted-foreground">{transfer.from_department.name}</p>
                )}
              </div>
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">To</p>
                <p className="font-medium">
                  {transfer.to_location?.name || transfer.to_department?.name || "Not specified"}
                </p>
                {transfer.to_sublocation?.name && (
                  <p className="text-xs text-muted-foreground">{transfer.to_sublocation.name}</p>
                )}
                {transfer.to_department?.name && transfer.to_location?.name && (
                  <p className="text-xs text-muted-foreground">{transfer.to_department.name}</p>
                )}
              </div>
            </div>

            {transfer.reason && (
              <div>
                <h3 className="font-semibold mb-2">Reason</h3>
                <p className="text-sm">{transfer.reason}</p>
              </div>
            )}

            {transfer.notes && (
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground">{transfer.notes}</p>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-2">Transfer Items</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    <TableHead className="text-right">Transferred</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.item_name}</TableCell>
                      <TableCell className="text-right">{item.quantity_requested}</TableCell>
                      <TableCell className="text-right">{item.quantity_transferred}</TableCell>
                      <TableCell>{item.unit_of_measure}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === "completed" ? "default" : "secondary"}>
                          {item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between gap-2">
              <div className="flex gap-2">
                {transfer.status === "draft" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleSubmitForApproval}
                      disabled={updateTransfer.isPending}
                    >
                      Submit for Approval
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </>
                )}

                {transfer.status === "pending_approval" && (
                  <>
                    <Button
                      onClick={handleApprove}
                      disabled={approveTransfer.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleCancel}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </>
                )}

                {transfer.status === "approved" && (
                  <Button
                    onClick={handleStartTransfer}
                    disabled={updateTransfer.isPending}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    Start Transfer
                  </Button>
                )}

                {transfer.status === "in_transit" && (
                  <Button
                    onClick={handleComplete}
                    disabled={completeTransfer.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Transfer
                  </Button>
                )}
              </div>

              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transfer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this stock transfer request and all its items.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
