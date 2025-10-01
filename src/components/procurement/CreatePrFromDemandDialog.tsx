import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, TrendingUp, Clock } from 'lucide-react';
import { DemandAnalysisResult, DemandPriority } from '@/types/materialDemand';

interface CreatePrFromDemandDialogProps {
  item: DemandAnalysisResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (adjustedQuantity: number, adjustedUnitPrice: number, priority: DemandPriority, notes: string) => void;
}

export const CreatePrFromDemandDialog: React.FC<CreatePrFromDemandDialogProps> = ({
  item,
  open,
  onOpenChange,
  onConfirm,
}) => {
  const [adjustedQuantity, setAdjustedQuantity] = useState<number>(0);
  const [adjustedUnitPrice, setAdjustedUnitPrice] = useState<number>(0);
  const [priority, setPriority] = useState<DemandPriority>('medium');
  const [notes, setNotes] = useState<string>('');

  // Initialize form values when item changes
  useEffect(() => {
    if (item) {
      setAdjustedQuantity(item.suggested_order);
      setAdjustedUnitPrice(item.supplier_info?.last_unit_cost || 0);
      setPriority(item.priority);
      setNotes('');
    }
  }, [item]);

  const handleConfirm = () => {
    if (adjustedQuantity <= 0) return;
    onConfirm(adjustedQuantity, adjustedUnitPrice, priority, notes);
    onOpenChange(false);
  };

  if (!item) return null;

  const totalCost = adjustedQuantity * adjustedUnitPrice;
  const isQuantityBelowShortage = adjustedQuantity < item.shortage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjust Purchase Requisition Quantity</DialogTitle>
          <DialogDescription>
            Review and adjust the suggested order quantity before creating the PR
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Item Information */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{item.item_name}</div>
                <div className="text-sm text-muted-foreground">
                  Code: {item.item_code} | Unit: {item.unit_of_measure}
                </div>
              </div>
              <Badge variant={item.shortage > 0 ? 'destructive' : 'default'}>
                {item.shortage > 0 ? 'Shortage' : 'Sufficient'}
              </Badge>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
              <div>
                <div className="text-xs text-muted-foreground">Total Required</div>
                <div className="text-lg font-semibold flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  {item.total_required}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Available Stock</div>
                <div className="text-lg font-semibold flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  {item.available_stock}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Shortage</div>
                <div className="text-lg font-semibold flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {item.shortage}
                </div>
              </div>
            </div>

            {item.lead_time_days > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                <Clock className="h-4 w-4" />
                Lead time: {item.lead_time_days} days
              </div>
            )}

            {item.supplier_info && (
              <div className="text-sm text-muted-foreground pt-2 border-t">
                Supplier: {item.supplier_info.supplier_name}
              </div>
            )}
          </div>

          {/* Quantity Adjustment */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">
                Order Quantity <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="0.01"
                value={adjustedQuantity}
                onChange={(e) => setAdjustedQuantity(parseFloat(e.target.value) || 0)}
                placeholder="Enter quantity"
              />
              <div className="text-xs text-muted-foreground">
                Suggested: {item.suggested_order} {item.unit_of_measure}
              </div>
              {isQuantityBelowShortage && (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  Warning: Quantity is below shortage amount ({item.shortage})
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitPrice">Estimated Unit Price</Label>
              <Input
                id="unitPrice"
                type="number"
                min="0"
                step="0.01"
                value={adjustedUnitPrice}
                onChange={(e) => setAdjustedUnitPrice(parseFloat(e.target.value) || 0)}
                placeholder="Enter unit price"
              />
              {item.supplier_info?.last_unit_cost && (
                <div className="text-xs text-muted-foreground">
                  Last cost: {item.supplier_info.last_unit_cost}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as DemandPriority)}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes / Justification</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes or justification for this requisition..."
                rows={3}
              />
            </div>

            {/* Total Cost Display */}
            <div className="bg-primary/5 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Estimated Total Cost:</div>
                <div className="text-xl font-bold">
                  {totalCost.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={adjustedQuantity <= 0}
          >
            Adjust & Create PR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
