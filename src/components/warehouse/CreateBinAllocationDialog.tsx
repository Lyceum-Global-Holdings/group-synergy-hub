import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useWarehouseBinAllocations } from '@/hooks/useWarehouseBinAllocations';
import { useWarehouseItems } from '@/hooks/useWarehouseItems';
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreateBinAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBinAllocationDialog({ open, onOpenChange }: CreateBinAllocationDialogProps) {
  const { createAllocation, isCreating } = useWarehouseBinAllocations();
  const { items } = useWarehouseItems();
  const { bins } = useWarehouseBins();
  
  const [formData, setFormData] = useState({
    warehouse_item_id: '',
    bin_id: '',
    allocated_quantity: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createAllocation({
      warehouse_item_id: formData.warehouse_item_id,
      bin_id: formData.bin_id,
      allocated_quantity: parseFloat(formData.allocated_quantity),
      notes: formData.notes || undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setFormData({
          warehouse_item_id: '',
          bin_id: '',
          allocated_quantity: '',
          notes: '',
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Allocate Item to Bin</DialogTitle>
          <DialogDescription>
            Assign a warehouse item to a specific bin location
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="warehouse_item_id">Warehouse Item *</Label>
            <Select
              value={formData.warehouse_item_id}
              onValueChange={(value) => setFormData({ ...formData, warehouse_item_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {items?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.item_code} - {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bin_id">Bin Location *</Label>
            <Select
              value={formData.bin_id}
              onValueChange={(value) => setFormData({ ...formData, bin_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select bin" />
              </SelectTrigger>
              <SelectContent>
                {bins?.map((bin) => (
                  <SelectItem key={bin.id} value={bin.id}>
                    {bin.bin_code} - {bin.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="allocated_quantity">Allocated Quantity *</Label>
            <Input
              id="allocated_quantity"
              type="number"
              step="0.01"
              min="0"
              value={formData.allocated_quantity}
              onChange={(e) => setFormData({ ...formData, allocated_quantity: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes about this allocation"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Allocation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
