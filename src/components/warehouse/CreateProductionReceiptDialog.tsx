import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { useFinishedGoodsBatches } from '@/hooks/useFinishedGoodsBatches';
import { useFinishedGoods } from '@/hooks/useFinishedGoods';

interface CreateProductionReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProductionReceiptDialog({ open, onOpenChange }: CreateProductionReceiptDialogProps) {
  const [formData, setFormData] = useState({
    batch_number: '',
    finished_good_id: '',
    quantity: '',
    production_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    production_cost: '',
    quality_check_status: 'pending',
    notes: '',
    status: 'active',
  });

  const { createBatch, isCreating } = useFinishedGoodsBatches();
  const { products } = useFinishedGoods();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      ...formData,
      quantity: parseFloat(formData.quantity),
      production_cost: formData.production_cost ? parseFloat(formData.production_cost) : undefined,
      expiry_date: formData.expiry_date || undefined,
    };

    createBatch(data);
    onOpenChange(false);
    setFormData({
      batch_number: '',
      finished_good_id: '',
      quantity: '',
      production_date: new Date().toISOString().split('T')[0],
      expiry_date: '',
      production_cost: '',
      quality_check_status: 'pending',
      notes: '',
      status: 'active',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Production Receipt</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="batch_number">Batch Number *</Label>
            <Input
              id="batch_number"
              value={formData.batch_number}
              onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
              required
              placeholder="e.g., BATCH-20241224-001"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="finished_good_id">Finished Good *</Label>
            <Select value={formData.finished_good_id} onValueChange={(value) => setFormData({ ...formData, finished_good_id: value })} required>
              <SelectTrigger>
                <SelectValue placeholder="Select finished good" />
              </SelectTrigger>
              <SelectContent>
                {products?.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.product_name} ({product.product_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="production_cost">Production Cost</Label>
              <Input
                id="production_cost"
                type="number"
                step="0.01"
                value={formData.production_cost}
                onChange={(e) => setFormData({ ...formData, production_cost: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="production_date">Production Date *</Label>
              <Input
                id="production_date"
                type="date"
                value={formData.production_date}
                onChange={(e) => setFormData({ ...formData, production_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry_date">Expiry Date</Label>
              <Input
                id="expiry_date"
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quality_check_status">Quality Status</Label>
            <Select value={formData.quality_check_status} onValueChange={(value) => setFormData({ ...formData, quality_check_status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Receipt'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}