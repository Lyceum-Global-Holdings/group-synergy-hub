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
import { Loader2, ShoppingCart, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface PurchaseConfirmationDialogProps {
  request: AssetRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseConfirmationDialog({ 
  request, 
  open, 
  onOpenChange 
}: PurchaseConfirmationDialogProps) {
  const [purchaseDate, setPurchaseDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [itemDetails, setItemDetails] = useState<Record<string, { vendor: string; poReference: string }>>({});
  
  const { confirmPurchase, isConfirmingPurchase, useAssetRequestItems } = useAssetRequests();
  const { data: items = [] } = useAssetRequestItems(request?.id);

  useEffect(() => {
    if (open && items.length > 0) {
      // Initialize item details
      const initial = items.reduce((acc, item) => ({
        ...acc,
        [item.id]: {
          vendor: item.preferred_vendor || "",
          poReference: ""
        }
      }), {});
      setItemDetails(initial);
    }
  }, [open, items]);

  const handleSubmit = () => {
    if (!request) return;

    const purchaseData = {
      request_id: request.id,
      purchase_date: purchaseDate,
      purchase_notes: purchaseNotes || undefined,
      item_details: items.map(item => ({
        item_id: item.id,
        vendor: itemDetails[item.id]?.vendor || null,
        po_reference: itemDetails[item.id]?.poReference || null,
      })),
    };

    confirmPurchase(purchaseData, {
      onSuccess: () => {
        setPurchaseDate(format(new Date(), "yyyy-MM-dd"));
        setPurchaseNotes("");
        setItemDetails({});
        onOpenChange(false);
      },
    });
  };

  const handleItemDetailChange = (itemId: string, field: 'vendor' | 'poReference', value: string) => {
    setItemDetails(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const isValid = purchaseDate.trim();

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <ShoppingCart className="h-6 w-6" />
                Confirm Items Purchased
              </DialogTitle>
              <DialogDescription>
                Record purchase details for request {request.request_number}
              </DialogDescription>
            </div>
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
              Procurement Action
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Purchase Details */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="purchase-date">
                Purchase Date *
              </Label>
              <Input
                id="purchase-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                max={format(new Date(), "yyyy-MM-dd")}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="purchase-notes">Purchase Notes</Label>
              <Textarea
                id="purchase-notes"
                value={purchaseNotes}
                onChange={(e) => setPurchaseNotes(e.target.value)}
                placeholder="Add any notes about the purchase (optional)"
                rows={3}
                className="mt-1"
              />
            </div>
          </div>

          {/* Items Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Purchased Items</h3>
              <Badge variant="outline">
                {items.length} items
              </Badge>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Approved Qty</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>PO Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const approvedQty = item.quantity_approved || item.quantity_requested;

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
                            placeholder="Vendor name"
                            value={itemDetails[item.id]?.vendor || ""}
                            onChange={(e) => handleItemDetailChange(item.id, 'vendor', e.target.value)}
                            className="w-full"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="PO number"
                            value={itemDetails[item.id]?.poReference || ""}
                            onChange={(e) => handleItemDetailChange(item.id, 'poReference', e.target.value)}
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
          <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-green-500 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-medium text-green-500">Next Steps After Purchase</p>
              <p className="text-sm text-muted-foreground">
                After confirming the purchase, you'll be able to mark the items as delivered once they
                arrive at the warehouse. The request status will change to "Items Purchased".
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isConfirmingPurchase}
            >
              Cancel
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={!isValid || isConfirmingPurchase}
            >
              {isConfirmingPurchase && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              <ShoppingCart className="h-4 w-4 mr-2" />
              Confirm Purchase
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}