import { useState, useEffect } from 'react';
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
import { useFinishedGoods } from '@/hooks/useFinishedGoods';
import { STANDARD_SIZES } from '@/constants/standardSizes';

interface EditFinishedGoodDialogProps {
  productId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditFinishedGoodDialog({ productId, open, onOpenChange }: EditFinishedGoodDialogProps) {
  const [formData, setFormData] = useState({
    product_name: '',
    product_code: '',
    style_no: '',
    size: '',
    color: '',
    variant: '',
    description: '',
    category: '',
    unit_of_measure: 'pcs',
    selling_price: '',
    standard_cost: '',
    minimum_stock: '',
    maximum_stock: '',
    reorder_point: '',
    lead_time_days: '',
    quality_status: 'approved',
    status: 'active',
    
  });

  const { products, updateProduct, isUpdating } = useFinishedGoods();

  const product = products?.find(p => p.id === productId);

  useEffect(() => {
    if (product) {
      setFormData({
        product_name: product.product_name || '',
        product_code: product.product_code || '',
        style_no: product.style_no || '',
        size: product.size || '',
        color: product.color || '',
        variant: product.variant || '',
        description: product.description || '',
        category: product.category || '',
        unit_of_measure: product.unit_of_measure || 'pcs',
        selling_price: product.selling_price?.toString() || '',
        standard_cost: product.standard_cost?.toString() || '',
        minimum_stock: product.minimum_stock?.toString() || '',
        maximum_stock: product.maximum_stock?.toString() || '',
        reorder_point: product.reorder_point?.toString() || '',
        lead_time_days: product.lead_time_days?.toString() || '',
        quality_status: product.quality_status || 'approved',
        status: product.status || 'active',
        
      });
    }
  }, [product]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation: ensure a size is selected
    if (!formData.size) {
      alert('Please select a size.');
      return;
    }
    
    const data = {
      ...formData,
      available_sizes: formData.size ? [formData.size] : [],
      selling_price: formData.selling_price ? parseFloat(formData.selling_price) : undefined,
      standard_cost: formData.standard_cost ? parseFloat(formData.standard_cost) : undefined,
      minimum_stock: formData.minimum_stock ? parseFloat(formData.minimum_stock) : undefined,
      maximum_stock: formData.maximum_stock ? parseFloat(formData.maximum_stock) : undefined,
      reorder_point: formData.reorder_point ? parseFloat(formData.reorder_point) : undefined,
      lead_time_days: formData.lead_time_days ? parseInt(formData.lead_time_days) : undefined,
    };

    updateProduct({ id: productId, data });
    onOpenChange(false);
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none rounded-none p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Finished Good</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product_name">Product Name *</Label>
              <Input
                id="product_name"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product_code">Product Code *</Label>
              <Input
                id="product_code"
                value={formData.product_code}
                onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="style_no">Style No</Label>
              <Input
                id="style_no"
                value={formData.style_no}
                onChange={(e) => setFormData({ ...formData, style_no: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="size">Size *</Label>
            <Select value={formData.size} onValueChange={(value) => setFormData({ ...formData, size: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a size" />
              </SelectTrigger>
              <SelectContent>
                {STANDARD_SIZES.map((size) => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label} ({size.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_of_measure">Unit of Measure</Label>
              <Select value={formData.unit_of_measure} onValueChange={(value) => setFormData({ ...formData, unit_of_measure: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pcs">Pieces</SelectItem>
                  <SelectItem value="kg">Kilograms</SelectItem>
                  <SelectItem value="m">Meters</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                  <SelectItem value="set">Set</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="selling_price">Selling Price</Label>
              <Input
                id="selling_price"
                type="number"
                step="0.01"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="standard_cost">Standard Cost</Label>
              <Input
                id="standard_cost"
                type="number"
                step="0.01"
                value={formData.standard_cost}
                onChange={(e) => setFormData({ ...formData, standard_cost: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? 'Updating...' : 'Update Product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}