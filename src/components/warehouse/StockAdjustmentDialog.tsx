import { useState, useEffect } from 'react';
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
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { useWarehouseBinAllocations } from '@/hooks/useWarehouseBinAllocations';

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
  const [binId, setBinId] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');

  const { createTransaction, isCreating } = useStockTransactions();
  const { bins } = useWarehouseBins();
  const { createAllocation, adjustAllocation, getAllocationsForItem } = useWarehouseBinAllocations();
  const [itemAllocations, setItemAllocations] = useState<any[]>([]);

  // Load allocations for this item when dialog opens
  useEffect(() => {
    const loadAllocations = async () => {
      if (open && itemId) {
        const allocations = await getAllocationsForItem(itemId);
        setItemAllocations(allocations);
      }
    };
    loadAllocations();
  }, [open, itemId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const quantityValue = parseFloat(quantity);
    if (isNaN(quantityValue) || quantityValue <= 0) return;

    if (!binId) {
      alert('Please select a bin location');
      return;
    }

    const quantityChange = adjustmentType === 'increase' ? quantityValue : -quantityValue;

    // Find existing allocation for this item and bin
    const existingAllocation = itemAllocations.find(a => a.bin_id === binId);

    if (existingAllocation) {
      // Adjust existing bin allocation - this will automatically update item stock via trigger
      adjustAllocation({
        id: existingAllocation.id,
        quantityChange: quantityChange,
      });
    } else if (adjustmentType === 'increase') {
      // Create new bin allocation for increase - this will automatically update item stock via trigger
      createAllocation({
        warehouse_item_id: itemId,
        bin_id: binId,
        allocated_quantity: quantityValue,
        notes: notes || `Initial allocation`,
      });
    } else {
      alert('Cannot decrease stock in a bin that has no allocation');
      return;
    }

    // Create transaction for audit trail
    createTransaction({
      item_id: itemId,
      transaction_type: 'adjustment' as StockTransactionType,
      reference_type: 'adjustment',
      quantity_change: quantityChange,
      quantity_before: currentStock,
      quantity_after: currentStock + quantityChange,
      unit_cost: unitCost ? parseFloat(unitCost) : undefined,
      total_value: unitCost ? parseFloat(unitCost) * Math.abs(quantityChange) : undefined,
      notes: notes || `Manual stock ${adjustmentType} - Bin: ${bins.find(b => b.id === binId)?.bin_code}`,
    });

    // Reset form
    setQuantity('');
    setBinId('');
    setUnitCost('');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
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
            <Label htmlFor="bin">Bin Location *</Label>
            <Select value={binId} onValueChange={setBinId}>
              <SelectTrigger>
                <SelectValue placeholder="Select bin location" />
              </SelectTrigger>
              <SelectContent>
                {bins.filter(bin => bin.status === 'active').map(bin => {
                  const allocation = itemAllocations.find(a => a.bin_id === bin.id);
                  const allocatedQty = allocation?.allocated_quantity || 0;
                  return (
                    <SelectItem key={bin.id} value={bin.id}>
                      {bin.bin_code} - {bin.name} {allocatedQty > 0 && `(Current: ${allocatedQty})`}
                    </SelectItem>
                  );
                })}
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