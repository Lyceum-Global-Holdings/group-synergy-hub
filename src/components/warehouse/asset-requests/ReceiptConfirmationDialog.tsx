import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAssetRequests } from "@/hooks/useAssetRequests";
import { AssetRequest, AssetRequestDelivery } from "@/types/assetRequest";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface ReceiptConfirmationDialogProps {
  request: AssetRequest | null;
  delivery: AssetRequestDelivery | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiptConfirmationDialog({
  request,
  delivery,
  open,
  onOpenChange,
}: ReceiptConfirmationDialogProps) {
  const [itemReceipts, setItemReceipts] = useState<Record<string, { quantity: number; notes: string }>>({});
  
  const { confirmReceipt, isConfirmingReceipt, useRequestDeliveries } = useAssetRequests();
  const { data: deliveries = [] } = useRequestDeliveries(request?.id);

  const currentDelivery = deliveries.find(d => d.id === delivery?.id);
  const deliveryItems = (currentDelivery as any)?.delivery_items || [];

  useEffect(() => {
    if (open && deliveryItems.length > 0) {
      // Initialize with delivered quantities
      const initial = deliveryItems.reduce((acc: any, item: any) => ({
        ...acc,
        [item.id]: {
          quantity: item.quantity_delivered,
          notes: ""
        }
      }), {});
      setItemReceipts(initial);
    }
  }, [open, deliveryItems]);

  const handleSubmit = () => {
    if (!request || !delivery) return;

    const receiptData = {
      request_id: request.id,
      delivery_id: delivery.id,
      items: deliveryItems.map((item: any) => ({
        delivery_item_id: item.id,
        request_item_id: item.request_item_id,
        quantity_received: itemReceipts[item.id]?.quantity || 0,
        receipt_notes: itemReceipts[item.id]?.notes || undefined,
      })),
    };

    confirmReceipt(receiptData, {
      onSuccess: () => {
        setItemReceipts({});
        onOpenChange(false);
      },
    });
  };

  const handleQuantityChange = (deliveryItemId: string, quantity: number) => {
    setItemReceipts(prev => ({
      ...prev,
      [deliveryItemId]: {
        ...prev[deliveryItemId],
        quantity: Math.max(0, quantity)
      }
    }));
  };

  const handleNotesChange = (deliveryItemId: string, notes: string) => {
    setItemReceipts(prev => ({
      ...prev,
      [deliveryItemId]: {
        ...prev[deliveryItemId],
        notes
      }
    }));
  };

  const getTotalReceiving = () => {
    return Object.values(itemReceipts).reduce((sum, item) => sum + item.quantity, 0);
  };

  const isValid = getTotalReceiving() > 0;

  if (!request || !delivery) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <CheckCircle className="h-6 w-6" />
                Confirm Receipt of Items
              </DialogTitle>
              <DialogDescription>
                Confirm receipt for delivery on {format(new Date(delivery.delivery_date), "PPP")}
              </DialogDescription>
            </div>
            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
              Receipt Confirmation
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Delivery Info */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Delivery Location:</span>
              <span className="font-medium">{delivery.delivery_location || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Delivery Date:</span>
              <span className="font-medium">{format(new Date(delivery.delivery_date), "PPP")}</span>
            </div>
            {delivery.delivery_notes && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Delivery Notes:</p>
                <p className="text-sm bg-background p-2 rounded border">{delivery.delivery_notes}</p>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Items to Confirm</h3>
              <Badge variant="outline">
                {getTotalReceiving()} units receiving
              </Badge>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Delivered Qty</TableHead>
                    <TableHead>Received Qty *</TableHead>
                    <TableHead>Receipt Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryItems.map((item: any) => {
                    const deliveredQty = item.quantity_delivered;
                    const receivingQty = itemReceipts[item.id]?.quantity || 0;
                    const hasDiscrepancy = receivingQty < deliveredQty;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.request_item?.item_name}</p>
                            {item.request_item?.brand && (
                              <p className="text-sm text-muted-foreground">{item.request_item.brand}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{deliveredQty}</span>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={deliveredQty}
                            value={receivingQty}
                            onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                            className={`w-24 ${hasDiscrepancy ? 'border-warning' : ''}`}
                          />
                          {hasDiscrepancy && receivingQty > 0 && (
                            <p className="text-xs text-warning mt-1">Discrepancy</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Textarea
                            placeholder={hasDiscrepancy ? "Explain discrepancy..." : "Optional notes"}
                            value={itemReceipts[item.id]?.notes || ""}
                            onChange={(e) => handleNotesChange(item.id, e.target.value)}
                            rows={2}
                            className="w-full"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Info Alert */}
          <div className="flex items-start gap-3 p-4 bg-success/10 border border-success/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-success mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-medium text-success">After Confirmation</p>
              <p className="text-sm text-muted-foreground">
                Confirming receipt will update the request status and automatically create asset entries in the warehouse inventory.
                Assets will be assigned to your department and ready for use.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isConfirmingReceipt}
            >
              Cancel
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={!isValid || isConfirmingReceipt}
            >
              {isConfirmingReceipt && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm Receipt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
