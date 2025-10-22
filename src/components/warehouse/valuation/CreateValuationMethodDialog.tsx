import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useValuationMethods } from '@/hooks/useValuationMethods';
import { ItemType, ValuationMethod } from '@/types/inventoryValuation';

interface CreateValuationMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateValuationMethodDialog({ open, onOpenChange }: CreateValuationMethodDialogProps) {
  const { createMethod, isCreating } = useValuationMethods();
  const [itemType, setItemType] = useState<ItemType>('raw_material');
  const [valuationMethod, setValuationMethod] = useState<ValuationMethod>('weighted_average');
  const [isDefault, setIsDefault] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createMethod({
      item_type: itemType,
      valuation_method: valuationMethod,
      is_default: isDefault,
      effective_from: effectiveFrom,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Valuation Method</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Item Type</Label>
            <Select value={itemType} onValueChange={(value) => setItemType(value as ItemType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="raw_material">Raw Materials</SelectItem>
                <SelectItem value="finished_good">Finished Goods</SelectItem>
                <SelectItem value="asset">Assets</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Valuation Method</Label>
            <Select value={valuationMethod} onValueChange={(value) => setValuationMethod(value as ValuationMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fifo">FIFO (First In, First Out)</SelectItem>
                <SelectItem value="lifo">LIFO (Last In, First Out)</SelectItem>
                <SelectItem value="weighted_average">Weighted Average</SelectItem>
                <SelectItem value="standard_cost">Standard Cost</SelectItem>
                <SelectItem value="actual_cost">Actual Cost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Effective From</Label>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_default"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked as boolean)}
            />
            <Label htmlFor="is_default" className="text-sm font-normal cursor-pointer">
              Set as default method for this item type
            </Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Method'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
