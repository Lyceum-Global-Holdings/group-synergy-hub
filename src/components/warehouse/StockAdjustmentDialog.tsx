import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { StockTransactionType } from '@/types/stockTransaction';

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  itemName: string;
  currentStock: number;
}

export function StockAdjustmentDialog({ 
  open, 
  onOpenChange, 
  itemId, 
  itemName, 
  currentStock 
}: StockAdjustmentDialogProps) {
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');

  const { createTransaction, isCreating } = useStockTransactions();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const quantityValue = parseFloat(quantity);
    if (isNaN(quantityValue) || quantityValue <= 0) return;

    const quantityChange = adjustmentType === 'increase' ? quantityValue : -quantityValue;
    const newQuantity = currentStock + quantityChange;

    if (newQuantity < 0) {
      alert('Adjustment would result in negative stock. Please check the quantity.');
      return;
    }

    createTransaction({
      item_id: itemId,
      transaction_type: 'adjustment' as StockTransactionType,
      reference_type: 'adjustment',
      quantity_change: quantityChange,
      quantity_before: currentStock,
      quantity_after: newQuantity,
      unit_cost: unitCost ? parseFloat(unitCost) : undefined,
      total_value: unitCost ? parseFloat(unitCost) * Math.abs(quantityChange) : undefined,
      notes: notes || `Manual stock ${adjustmentType}`,
    });

    // Reset form
    setQuantity('');
    setUnitCost('');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock - {itemName}</DialogTitle>
          <DialogDescription>
            Current stock: {currentStock} units
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Adjustment Type</Label>
            <Select value={adjustmentType} onValueChange={(value: 'increase' | 'decrease') => setAdjustmentType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="increase">Increase Stock</SelectItem>
                <SelectItem value="decrease">Decrease Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              min="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity to adjust"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit_cost">Unit Cost</Label>
            <Input
              id="unit_cost"
              type="number"
              step="0.01"
              min="0"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="Enter unit cost (optional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for adjustment"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {adjustmentType === 'increase' ? 'Increase Stock' : 'Decrease Stock'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}