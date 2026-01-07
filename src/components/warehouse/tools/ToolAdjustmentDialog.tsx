import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { WarehouseTool } from "@/types/toolManagement";
import { useToolAdjustments } from "@/hooks/useToolAdjustments";
import { ArrowUp, ArrowDown } from "lucide-react";

interface ToolAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: WarehouseTool | null;
}

const ADJUSTMENT_REASONS = [
  "Physical count correction",
  "Damaged",
  "Lost",
  "Found",
  "Initial stock",
  "Received from supplier",
  "Transferred in",
  "Transferred out",
  "Write-off",
  "Other",
];

export function ToolAdjustmentDialog({
  open,
  onOpenChange,
  tool,
}: ToolAdjustmentDialogProps) {
  const [adjustmentType, setAdjustmentType] = useState<"increase" | "decrease">("increase");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const { adjustToolQuantity, isAdjusting } = useToolAdjustments();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tool) return;

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) return;

    adjustToolQuantity(
      {
        tool,
        adjustmentType,
        quantity: qty,
        reason,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      }
    );
  };

  const resetForm = () => {
    setAdjustmentType("increase");
    setQuantity("");
    setReason("");
    setNotes("");
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  if (!tool) return null;

  const qtyNum = parseInt(quantity, 10) || 0;
  const newTotal = adjustmentType === "increase" 
    ? tool.total_quantity + qtyNum 
    : tool.total_quantity - qtyNum;
  const newAvailable = adjustmentType === "increase"
    ? tool.available_quantity + qtyNum
    : tool.available_quantity - qtyNum;

  const isValid = qtyNum > 0 && reason && newTotal >= 0 && newAvailable >= 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adjust Tool Quantity</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tool Info */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{tool.name}</span>
              <Badge variant="outline">{tool.tool_code}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total:</span>
                <span className="ml-2 font-medium">{tool.total_quantity}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Available:</span>
                <span className="ml-2 font-medium text-green-600">{tool.available_quantity}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Issued:</span>
                <span className="ml-2 font-medium text-orange-600">{tool.issued_quantity}</span>
              </div>
            </div>
          </div>

          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label>Adjustment Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={adjustmentType === "increase" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setAdjustmentType("increase")}
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Increase
              </Button>
              <Button
                type="button"
                variant={adjustmentType === "decrease" ? "destructive" : "outline"}
                className="flex-1"
                onClick={() => setAdjustmentType("decrease")}
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                Decrease
              </Button>
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={adjustmentType === "decrease" ? tool.available_quantity : undefined}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity to adjust"
              required
            />
            {adjustmentType === "decrease" && (
              <p className="text-sm text-muted-foreground">
                Maximum: {tool.available_quantity} (available quantity)
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Select value={reason} onValueChange={setReason} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          {/* Preview */}
          {qtyNum > 0 && (
            <div className="rounded-lg border p-4 bg-muted/30">
              <div className="text-sm font-medium mb-2">After Adjustment:</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">New Total:</span>
                  <span className={`ml-2 font-medium ${newTotal < 0 ? "text-destructive" : ""}`}>
                    {tool.total_quantity} → {newTotal}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">New Available:</span>
                  <span className={`ml-2 font-medium ${newAvailable < 0 ? "text-destructive" : ""}`}>
                    {tool.available_quantity} → {newAvailable}
                  </span>
                </div>
              </div>
              {(newTotal < 0 || newAvailable < 0) && (
                <p className="text-sm text-destructive mt-2">
                  Cannot decrease below zero
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isAdjusting}>
              {isAdjusting ? "Adjusting..." : "Apply Adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
