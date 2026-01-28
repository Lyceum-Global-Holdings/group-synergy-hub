import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MaterialRequest, MaterialRequestItem } from "@/types/materialIssueReturn";

interface AdjustRequestQuantitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: MaterialRequest;
  items: MaterialRequestItem[];
  onSuccess: () => void;
}

interface AdjustmentItem extends MaterialRequestItem {
  new_quantity: number;
  adjustment_reason: string;
}

export function AdjustRequestQuantitiesDialog({
  open,
  onOpenChange,
  request,
  items,
  onSuccess,
}: AdjustRequestQuantitiesDialogProps) {
  const { toast } = useToast();
  const [adjustmentItems, setAdjustmentItems] = useState<AdjustmentItem[]>(
    items.map(item => ({
      ...item,
      new_quantity: item.quantity_requested,
      adjustment_reason: item.adjustment_reason || '',
    }))
  );
  const [saving, setSaving] = useState(false);

  const canAdjust = request.status === 'draft' || request.status === 'approved';

  const handleQuantityChange = (itemId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setAdjustmentItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, new_quantity: numValue } : item
      )
    );
  };

  const handleReasonChange = (itemId: string, value: string) => {
    setAdjustmentItems(items =>
      items.map(item =>
        item.id === itemId ? { ...item, adjustment_reason: value } : item
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validate that changed items have reasons
      const changedItems = adjustmentItems.filter(
        item => item.new_quantity !== item.quantity_requested
      );

      for (const item of changedItems) {
        if (!item.adjustment_reason || item.adjustment_reason.trim() === '') {
          toast({
            title: "Missing Adjustment Reason",
            description: `Please provide a reason for adjusting ${item.item_name}`,
            variant: "destructive",
          });
          return;
        }

        if (item.new_quantity < 0) {
          toast({
            title: "Invalid Quantity",
            description: `Quantity must be positive for ${item.item_name}`,
            variant: "destructive",
          });
          return;
        }

        // Check if adjustment is valid based on status
        if (request.status === 'approved' && item.new_quantity > item.quantity_requested) {
          toast({
            title: "Invalid Adjustment",
            description: `Cannot increase quantity after approval for ${item.item_name}. Current: ${item.quantity_requested}`,
            variant: "destructive",
          });
          return;
        }
      }

      // Update all changed items
      for (const item of changedItems) {
        const updates: any = {
          quantity_requested: item.new_quantity,
          adjustment_reason: item.adjustment_reason,
        };

        // If already approved, also adjust the approved quantity proportionally
        if (request.status === 'approved' && item.quantity_approved) {
          const adjustmentRatio = item.new_quantity / item.quantity_requested;
          updates.quantity_approved = Math.floor(item.quantity_approved * adjustmentRatio);
        }

        const { error } = await supabase
          .from('material_request_items')
          .update(updates)
          .eq('id', item.id);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `${changedItems.length} item(s) adjusted successfully`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adjusting quantities:', error);
      toast({
        title: "Error",
        description: "Failed to adjust quantities",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!canAdjust) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Quantities</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center text-muted-foreground">
            Quantities cannot be adjusted in the current status: {request.status}
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
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjust Request Quantities</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Adjust quantities as needed. You must provide a reason for any changes.
            {request.status === 'approved' && (
              <div className="mt-2 text-amber-600">
                ⚠️ Request is already approved. Only reductions are allowed.
              </div>
            )}
          </div>

          {adjustmentItems.map((item) => {
            const hasChanged = item.new_quantity !== item.quantity_requested;
            return (
              <div key={item.id} className={`border rounded-lg p-4 space-y-3 ${hasChanged ? 'border-primary' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{item.item_name}</div>
                    <div className="text-sm text-muted-foreground">
                      Current Requested: {item.quantity_requested} {item.unit_of_measure}
                      {item.quantity_approved && ` | Approved: ${item.quantity_approved}`}
                      {item.quantity_issued > 0 && ` | Issued: ${item.quantity_issued}`}
                      {item.quantity_received > 0 && ` | Received: ${item.quantity_received}`}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`qty-${item.id}`}>New Quantity *</Label>
                    <Input
                      id={`qty-${item.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.new_quantity}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`reason-${item.id}`}>
                      Reason for Adjustment {hasChanged && '*'}
                    </Label>
                    <Textarea
                      id={`reason-${item.id}`}
                      value={item.adjustment_reason}
                      onChange={(e) => handleReasonChange(item.id, e.target.value)}
                      placeholder="Explain why this adjustment is needed..."
                      className="h-20"
                      required={hasChanged}
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
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Adjustments"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
