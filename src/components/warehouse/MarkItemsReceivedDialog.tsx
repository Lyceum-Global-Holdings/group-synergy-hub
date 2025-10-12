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
    if (receiptItems.some(item => item.quantity_to_receive <= 0)) {
      toast({
        title: "Invalid Quantity",
        description: "All quantities must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    const invalidItems = receiptItems.filter(item => 
      (item.quantity_received || 0) + item.quantity_to_receive > (item.quantity_issued || 0)
    );
    
    if (invalidItems.length > 0) {
      toast({
        title: "Invalid Quantity",
        description: "Cannot receive more than issued quantity",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      for (const item of receiptItems) {
        if (item.quantity_to_receive <= 0) continue;

        const newQuantityReceived = (item.quantity_received || 0) + item.quantity_to_receive;
        
        const { error: updateError } = await supabase
          .from('material_request_items')
          .update({
            quantity_received: newQuantityReceived,
            received_at: new Date().toISOString(),
            received_by: user.id,
            adjustment_reason: item.notes || null
          })
          .eq('id', item.id);

        if (updateError) throw updateError;
      }

      const { data: allItems, error: fetchError } = await supabase
        .from('material_request_items')
        .select('quantity_issued, quantity_received')
        .eq('request_id', requestId);

      if (fetchError) throw fetchError;

      const allFullyReceived = allItems?.every(item => 
        (item.quantity_received || 0) >= (item.quantity_issued || 0) && (item.quantity_issued || 0) > 0
      );
      const anyReceived = allItems?.some(item => (item.quantity_received || 0) > 0);

      const newStatus = allFullyReceived ? 'completed' : (anyReceived ? 'partially_received' : 'issued');
      
      const { error: statusError } = await supabase
        .from('material_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (statusError) throw statusError;

      toast({
        title: "Success",
        description: `Items marked as received. Status: ${newStatus.replace(/_/g, ' ')}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error receiving items:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to mark items as received",
        variant: "destructive",
      });
    }
  };

  if (receiptItems.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Items Received</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center text-muted-foreground">
            No items available to receive
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark Items Received</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {receiptItems.map((item) => (
            <div key={item.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{item.item_name}</div>
                  <div className="text-sm text-muted-foreground">Code: {item.item_code}</div>
                  <div className="text-sm text-muted-foreground">
                    Issued: {item.quantity_issued} | Already Received: {item.quantity_received}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantity to Receive</Label>
                  <Input
                    type="number"
                    value={item.quantity_to_receive}
                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                    min="0"
                    max={(item.quantity_issued || 0) - item.quantity_received}
                    step="0.01"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={item.notes || ''}
                    onChange={(e) => handleNotesChange(item.id, e.target.value)}
                    placeholder="Optional notes"
                    rows={1}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleReceive}>Confirm Receipt</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
