import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MaterialRequestItem } from "@/types/materialIssueReturn";

interface MarkItemsReceivedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  items: MaterialRequestItem[];
  onSuccess: () => void;
}

interface ReceiptItem extends Omit<MaterialRequestItem, 'notes'> {
  quantity_to_receive: number;
  notes?: string;
}

export function MarkItemsReceivedDialog({
  open,
  onOpenChange,
  requestId,
  items,
  onSuccess,
}: MarkItemsReceivedDialogProps) {
  const { toast } = useToast();
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>(
    items.filter(item => item.quantity_issued && item.quantity_issued > item.quantity_received)
      .map(item => ({
        ...item,
        quantity_to_receive: (item.quantity_issued || 0) - item.quantity_received,
      }))
  );
  const [receiving, setReceiving] = useState(false);

  const handleQuantityChange = (itemId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setReceiptItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, quantity_to_receive: numValue } : item
      )
    );
  };

  const handleNotesChange = (itemId: string, value: string) => {
    setReceiptItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, notes: value } : item
      )
    );
  };

  const handleReceive = async () => {
    try {
      setReceiving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Validate quantities
      for (const item of receiptItems) {
        const maxReceivable = (item.quantity_issued || 0) - item.quantity_received;
        if (item.quantity_to_receive > maxReceivable) {
          toast({
            title: "Invalid Quantity",
            description: `Cannot receive more than ${maxReceivable} for ${item.item_name}`,
            variant: "destructive",
          });
          return;
        }
        if (item.quantity_to_receive < 0) {
          toast({
            title: "Invalid Quantity",
            description: `Quantity must be positive for ${item.item_name}`,
            variant: "destructive",
          });
          return;
        }
      }

      // Update all items
      for (const item of receiptItems.filter(i => i.quantity_to_receive > 0)) {
        const newQuantityReceived = item.quantity_received + item.quantity_to_receive;
        const adjustmentReason = item.quantity_to_receive < ((item.quantity_issued || 0) - item.quantity_received)
          ? `Partial receipt: ${item.notes || 'No reason provided'}`
          : undefined;

        const { error } = await supabase
          .from('material_request_items')
          .update({
            quantity_received: newQuantityReceived,
            received_at: new Date().toISOString(),
            received_by: user.id,
            adjustment_reason: adjustmentReason || item.adjustment_reason,
          })
          .eq('id', item.id);

        if (error) throw error;
      }

      // Fetch all items for this request to determine final status
      const { data: allItems, error: fetchError } = await supabase
        .from('material_request_items')
        .select('quantity_issued, quantity_received')
        .eq('request_id', requestId);

      if (fetchError) throw fetchError;

      // Determine if request is fully completed or partially received
      const allFullyReceived = allItems?.every(
        item => item.quantity_received >= (item.quantity_issued || 0) && (item.quantity_issued || 0) > 0
      );

      const newStatus = allFullyReceived ? 'completed' : 'partially_received';

      // Update the material request status
      const { error: statusError } = await supabase
        .from('material_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (statusError) throw statusError;

      toast({
        title: "Success",
        description: "Items marked as received successfully",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error marking items as received:', error);
      toast({
        title: "Error",
        description: "Failed to mark items as received",
        variant: "destructive",
      });
    } finally {
      setReceiving(false);
    }
  };

  if (receiptItems.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Items as Received</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center text-muted-foreground">
            No items available to receive
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark Items as Received</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Confirm the quantities you received. Enter partial quantities if you received less than issued.
          </div>

          {receiptItems.map((item) => {
            const maxReceivable = (item.quantity_issued || 0) - item.quantity_received;
            return (
              <div key={item.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{item.item_name}</div>
                    <div className="text-sm text-muted-foreground">
                      Issued: {item.quantity_issued} | Already Received: {item.quantity_received} | Pending: {maxReceivable}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`qty-${item.id}`}>Quantity Receiving Now *</Label>
                    <Input
                      id={`qty-${item.id}`}
                      type="number"
                      min="0"
                      max={maxReceivable}
                      step="0.01"
                      value={item.quantity_to_receive}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`notes-${item.id}`}>Notes (if partial or variance)</Label>
                    <Textarea
                      id={`notes-${item.id}`}
                      value={item.notes || ''}
                      onChange={(e) => handleNotesChange(item.id, e.target.value)}
                      placeholder="Reason for partial receipt or variance..."
                      className="h-20"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={receiving}
          >
            Cancel
          </Button>
          <Button onClick={handleReceive} disabled={receiving}>
            {receiving ? "Processing..." : "Confirm Receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
