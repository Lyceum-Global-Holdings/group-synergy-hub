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
import { AssetRequest } from "@/types/assetRequest";
import { Loader2, Package, AlertTriangle } from "lucide-react";

interface DeliveryDialogProps {
  request: AssetRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeliveryDialog({ request, open, onOpenChange }: DeliveryDialogProps) {
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [itemDeliveries, setItemDeliveries] = useState<Record<string, { quantity: number; notes: string }>>({});
  
  const { markAsDelivered, isMarkingAsDelivered, useAssetRequestItems } = useAssetRequests();
  const { data: items = [] } = useAssetRequestItems(request?.id);

  useEffect(() => {
    if (open && items.length > 0) {
      // Initialize with approved quantities
      const initial = items.reduce((acc, item) => ({
        ...acc,
        [item.id]: {
          quantity: item.quantity_approved || item.quantity_requested,
          notes: ""
        }
      }), {});
      setItemDeliveries(initial);
    }

    if (open && request?.department) {
      setDeliveryLocation(request.department);
    }
  }, [open, items, request]);

  const handleSubmit = () => {
    if (!request) return;

    const deliveryData = {
      request_id: request.id,
      delivery_location: deliveryLocation,
      delivery_notes: deliveryNotes || undefined,
      items: items
        .filter(item => (itemDeliveries[item.id]?.quantity || 0) > 0)
        .map(item => ({
          request_item_id: item.id,
          quantity_delivered: itemDeliveries[item.id].quantity,
          delivery_notes: itemDeliveries[item.id].notes || undefined,
        })),
    };

    markAsDelivered(deliveryData, {
      onSuccess: () => {
        setDeliveryLocation("");
        setDeliveryNotes("");
        setItemDeliveries({});
        onOpenChange(false);
      },
    });
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setItemDeliveries(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        quantity: Math.max(0, quantity)
      }
    }));
  };

  const handleNotesChange = (itemId: string, notes: string) => {
    setItemDeliveries(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        notes
      }
    }));
  };

  const getTotalDelivering = () => {
    return Object.values(itemDeliveries).reduce((sum, item) => sum + item.quantity, 0);
  };

  const isValid = deliveryLocation.trim() && getTotalDelivering() > 0;

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Package className="h-6 w-6" />
                Mark Items as Delivered
              </DialogTitle>
              <DialogDescription>
                Record delivery of items for request {request.request_number}
              </DialogDescription>
            </div>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
              Procurement Action
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Delivery Details */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="delivery-location">
                Delivery Location *
              </Label>
              <Input
                id="delivery-location"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                placeholder="Enter delivery location (department, warehouse, etc.)"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="delivery-notes">Delivery Notes</Label>
              <Textarea
                id="delivery-notes"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Add any notes about the delivery (optional)"
                rows={3}
                className="mt-1"
              />
            </div>
          </div>

          {/* Items Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Items to Deliver</h3>
              <Badge variant="outline">
                {getTotalDelivering()} units total
              </Badge>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Approved Qty</TableHead>
                    <TableHead>Delivering Qty *</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const approvedQty = item.quantity_approved || item.quantity_requested;
                    const deliveringQty = itemDeliveries[item.id]?.quantity || 0;
                    const hasShortage = deliveringQty < approvedQty;

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
                          <span className="font-medium">{approvedQty}</span>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={approvedQty}
                            value={deliveringQty}
                            onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                            className={`w-24 ${hasShortage ? 'border-warning' : ''}`}
                          />
                          {hasShortage && deliveringQty > 0 && (
                            <p className="text-xs text-warning mt-1">Partial delivery</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Optional notes"
                            value={itemDeliveries[item.id]?.notes || ""}
                            onChange={(e) => handleNotesChange(item.id, e.target.value)}
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
          <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-medium text-blue-500">After Delivery</p>
              <p className="text-sm text-muted-foreground">
                Once marked as delivered, the requester will be notified to confirm receipt of the items.
                The request status will change to "Pending Receipt".
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isMarkingAsDelivered}
            >
              Cancel
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={!isValid || isMarkingAsDelivered}
            >
              {isMarkingAsDelivered && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <Package className="h-4 w-4 mr-2" />
              Mark as Delivered
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
