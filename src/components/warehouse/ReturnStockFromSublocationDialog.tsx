import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { useWarehouseItems } from '@/hooks/useWarehouseItems';
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { useWarehouseBinAllocations } from '@/hooks/useWarehouseBinAllocations';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import { Undo2 } from 'lucide-react';

interface ReturnStockFromSublocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReturnStockFromSublocationDialog({
  open,
  onOpenChange,
}: ReturnStockFromSublocationDialogProps) {
  const { selectedCompany } = useCompany();
  const { items } = useWarehouseItems();
  const { bins } = useWarehouseBins();
  const { binAllocations, createAllocation, updateAllocation } = useWarehouseBinAllocations();
  const { createTransaction } = useStockTransactions();

  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedBinId, setSelectedBinId] = useState('');
  const [returnQuantity, setReturnQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter items with stock
  const activeItems = items?.filter(item => item.status === 'active') || [];

  // Filter bins by company
  const companyBins = selectedCompany?.id 
    ? bins?.filter(bin => bin.company_id === selectedCompany.id) || []
    : bins || [];

  // Get existing allocation for selected item and bin
  const existingAllocation = binAllocations?.find(
    alloc => alloc.warehouse_item_id === selectedItemId && alloc.bin_id === selectedBinId
  );

  // Get selected item details
  const selectedItem = activeItems.find(item => item.id === selectedItemId);

  useEffect(() => {
    if (!open) {
      setSelectedItemId('');
      setSelectedBinId('');
      setReturnQuantity('');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedItemId || !selectedBinId || !returnQuantity) {
      toast.error('Please fill all required fields');
      return;
    }

    const quantity = parseFloat(returnQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current stock for the item
      const currentStock = selectedItem?.current_stock || 0;
      const newStock = currentStock + quantity;

      // Create a stock transaction for the return
      await createTransaction({
        item_id: selectedItemId,
        transaction_type: 'adjustment',
        reference_type: 'manual',
        quantity_change: quantity,
        quantity_before: currentStock,
        quantity_after: newStock,
        notes: notes || `Stock return from sub-location to bin`,
      });

      // Update or create bin allocation
      if (existingAllocation) {
        // Update existing allocation
        await updateAllocation({
          id: existingAllocation.id,
          updates: {
            allocated_quantity: existingAllocation.allocated_quantity + quantity,
          },
        });
      } else {
        // Create new allocation
        await createAllocation({
          warehouse_item_id: selectedItemId,
          bin_id: selectedBinId,
          allocated_quantity: quantity,
          notes: notes || 'Stock return from sub-location',
        });
      }

      toast.success(`Successfully returned ${quantity} units to stock`);
      onOpenChange(false);
    } catch (error) {
      console.error('Error returning stock:', error);
      toast.error('Failed to return stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5" />
            Return Stock from Sub-location
          </DialogTitle>
          <DialogDescription>
            Increase stock by returning items from a sub-location back to the warehouse bin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="item">Item *</Label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Select item to return" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50 max-h-60">
                {activeItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.item_code} - {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bin">Return to Bin *</Label>
            <Select value={selectedBinId} onValueChange={setSelectedBinId}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination bin" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50 max-h-60">
                {companyBins.map((bin) => (
                  <SelectItem key={bin.id} value={bin.id}>
                    {bin.bin_code} - {bin.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedItem && (
            <div className="p-3 bg-muted rounded-md text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Stock:</span>
                <span className="font-medium">{selectedItem.current_stock || 0}</span>
              </div>
              {existingAllocation && (
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Current Bin Allocation:</span>
                  <span className="font-medium">{existingAllocation.allocated_quantity}</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="quantity">Return Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Enter quantity to return"
              value={returnQuantity}
              onChange={(e) => setReturnQuantity(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add notes about this return (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Processing...' : 'Return Stock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}