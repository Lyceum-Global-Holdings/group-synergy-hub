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
import { useProductMaster } from '@/hooks/useProductMaster';
import { useApparelCategories } from '@/hooks/useApparelCategories';
import { MultiColorSelector } from '@/components/common/MultiColorSelector';
import { MultiSizeSelector } from '@/components/common/MultiSizeSelector';
import { ProductMaster } from '@/types/productMaster';

interface EditProductMasterDialogProps {
  productMaster: ProductMaster;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProductMasterDialog({ productMaster, open, onOpenChange }: EditProductMasterDialogProps) {
  const [formData, setFormData] = useState<{
    product_code: string;
    product_name: string;
    style_no: string;
    description: string;
    category_id: string;
    unit_of_measure: string;
    base_price: string;
    status: 'active' | 'inactive' | 'discontinued';
  }>({
    product_code: productMaster.product_code,
    product_name: productMaster.product_name,
    style_no: productMaster.style_no || '',
    description: productMaster.description || '',
    category_id: productMaster.category_id || '',
    unit_of_measure: productMaster.unit_of_measure,
    base_price: productMaster.base_price?.toString() || '',
    status: productMaster.status,
  });
  const [selectedColors, setSelectedColors] = useState<string[]>(productMaster.available_colors);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(productMaster.available_sizes);

  const { updateProductMaster, isUpdating } = useProductMaster();
  const { apparelCategories } = useApparelCategories();

  useEffect(() => {
    setFormData({
      product_code: productMaster.product_code,
      product_name: productMaster.product_name,
      style_no: productMaster.style_no || '',
      description: productMaster.description || '',
      category_id: productMaster.category_id || '',
      unit_of_measure: productMaster.unit_of_measure,
      base_price: productMaster.base_price?.toString() || '',
      status: productMaster.status,
    });
    setSelectedColors(productMaster.available_colors);
    setSelectedSizes(productMaster.available_sizes);
  }, [productMaster]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedColors.length === 0 && selectedSizes.length === 0) {
      alert('Please select at least one color or size.');
      return;
    }
    
    updateProductMaster({
      id: productMaster.id,
      product_code: formData.product_code,
      product_name: formData.product_name,
      style_no: formData.style_no || undefined,
      description: formData.description || undefined,
      category_id: formData.category_id || undefined,
      unit_of_measure: formData.unit_of_measure,
      available_colors: selectedColors,
      available_sizes: selectedSizes,
      base_price: formData.base_price ? parseFloat(formData.base_price) : undefined,
      status: formData.status as 'active' | 'inactive' | 'discontinued',
    });
    onOpenChange(false);
  };

  const parentCategories = apparelCategories.filter(c => !c.parent_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product Master</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product_code">Product Code *</Label>
              <Input
                id="product_code"
                value={formData.product_code}
                onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product_name">Product Name *</Label>
              <Input
                id="product_name"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="style_no">Style No</Label>
            <Input
              id="style_no"
              value={formData.style_no}
              onChange={(e) => setFormData({ ...formData, style_no: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {parentCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div className="space-y-2">
            <Label>Available Colors</Label>
            <MultiColorSelector
              selectedColors={selectedColors}
              onColorsChange={setSelectedColors}
              showAddNew={true}
            />
          </div>

          <div className="space-y-2">
            <Label>Available Sizes</Label>
            <MultiSizeSelector
              selectedSizes={selectedSizes}
              onSizesChange={setSelectedSizes}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="base_price">Base Price</Label>
              <Input
                id="base_price"
                type="number"
                step="0.01"
                value={formData.base_price}
                onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value: 'active' | 'inactive' | 'discontinued') => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
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
              {isUpdating ? 'Updating...' : 'Update Product Master'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
