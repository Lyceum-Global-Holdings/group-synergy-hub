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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useFinishedGoods } from '@/hooks/useFinishedGoods';
import { useProductMaster, ProductMaster } from '@/hooks/useProductMaster';
import { ProductMasterSelector } from '@/components/common/ProductMasterSelector';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { STANDARD_SIZES } from '@/constants/standardSizes';

interface CreateFinishedGoodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFinishedGoodDialog({ open, onOpenChange }: CreateFinishedGoodDialogProps) {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [useProductMaster, setUseProductMaster] = useState(true);
  const [selectedProductMaster, setSelectedProductMaster] = useState<ProductMaster | null>(null);
  
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

  const { createProduct, isCreating } = useFinishedGoods();

  // Auto-populate fields when product master is selected
  const handleProductMasterSelect = (product: ProductMaster | null) => {
    setSelectedProductMaster(product);
    if (product) {
      setFormData({
        ...formData,
        product_name: product.product_name,
        product_code: product.product_code,
        style_no: product.style_no || '',
        description: product.description || '',
        unit_of_measure: product.unit_of_measure || 'pcs',
        // Clear size and color for user selection
        size: '',
        color: '',
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (useProductMaster && !selectedProductMaster) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select a product template",
      });
      return;
    }

    if (!formData.size) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select a size",
      });
      return;
    }

    if (useProductMaster && selectedProductMaster) {
      // Validate size selection
      const availableSizes = selectedProductMaster.available_sizes as string[];
      if (availableSizes && availableSizes.length > 0 && !availableSizes.includes(formData.size)) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Selected size is not available for this product",
        });
        return;
      }

      // Validate color selection
      const availableColors = selectedProductMaster.available_colors as string[];
      if (formData.color && availableColors && availableColors.length > 0 && !availableColors.includes(formData.color)) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Selected color is not available for this product",
        });
        return;
      }
    }
    
    const data = {
      ...formData,
      available_sizes: formData.size ? [formData.size] : [],
      company_id: selectedCompany?.id,
      product_master_id: selectedProductMaster?.id || undefined,
      selling_price: formData.selling_price ? parseFloat(formData.selling_price) : undefined,
      standard_cost: formData.standard_cost ? parseFloat(formData.standard_cost) : undefined,
      minimum_stock: formData.minimum_stock ? parseFloat(formData.minimum_stock) : undefined,
      maximum_stock: formData.maximum_stock ? parseFloat(formData.maximum_stock) : undefined,
      reorder_point: formData.reorder_point ? parseFloat(formData.reorder_point) : undefined,
      lead_time_days: formData.lead_time_days ? parseInt(formData.lead_time_days) : undefined,
    };

    createProduct(data);
    onOpenChange(false);
    
    // Reset form
    setUseProductMaster(true);
    setSelectedProductMaster(null);
    setFormData({
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
  };

  const isFieldDisabled = useProductMaster && !!selectedProductMaster;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Finished Good</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mode Selection */}
          <div className="flex items-center space-x-2 p-3 border rounded-md bg-muted/50">
            <Checkbox
              id="useProductMaster"
              checked={useProductMaster}
              onCheckedChange={(checked) => {
                setUseProductMaster(checked as boolean);
                if (!checked) {
                  setSelectedProductMaster(null);
                }
              }}
            />
            <label
              htmlFor="useProductMaster"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Create from Product Master Template (Recommended)
            </label>
          </div>

          {/* Product Master Selector */}
          {useProductMaster && (
            <div className="space-y-2">
              <Label>Product Template *</Label>
              <ProductMasterSelector
                value={selectedProductMaster?.id}
                onSelect={handleProductMasterSelect}
                placeholder="Select a product template..."
              />
              {selectedProductMaster && (
                <div className="text-sm text-muted-foreground">
                  Product details auto-populated. Select size and color variant below.
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product_name">Product Name *</Label>
              <Input
                id="product_name"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                disabled={isFieldDisabled}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product_code">Product Code *</Label>
              <Input
                id="product_code"
                value={formData.product_code}
                onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                disabled={isFieldDisabled}
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
                disabled={isFieldDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              {useProductMaster && selectedProductMaster && (selectedProductMaster.available_colors as string[])?.length > 0 ? (
                <div className="space-y-2">
                  <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select from available colors" />
                    </SelectTrigger>
                    <SelectContent>
                      {(selectedProductMaster.available_colors as string[]).map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1">
                    {(selectedProductMaster.available_colors as string[]).map((c) => (
                      <Badge key={c} variant="outline" className="text-xs">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <Input
                  id="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="size">Size *</Label>
            {useProductMaster && selectedProductMaster && (selectedProductMaster.available_sizes as string[])?.length > 0 ? (
              <div className="space-y-2">
                <Select value={formData.size} onValueChange={(value) => setFormData({ ...formData, size: value })} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select from available sizes" />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedProductMaster.available_sizes as string[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1">
                  {(selectedProductMaster.available_sizes as string[]).map((s) => (
                    <Badge key={s} variant="outline" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <Select value={formData.size} onValueChange={(value) => setFormData({ ...formData, size: value })} required>
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
            )}
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
              <Select 
                value={formData.unit_of_measure} 
                onValueChange={(value) => setFormData({ ...formData, unit_of_measure: value })}
                disabled={isFieldDisabled}
              >
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

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minimum_stock">Minimum Stock</Label>
              <Input
                id="minimum_stock"
                type="number"
                step="0.01"
                value={formData.minimum_stock}
                onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maximum_stock">Maximum Stock</Label>
              <Input
                id="maximum_stock"
                type="number"
                step="0.01"
                value={formData.maximum_stock}
                onChange={(e) => setFormData({ ...formData, maximum_stock: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reorder_point">Reorder Point</Label>
              <Input
                id="reorder_point"
                type="number"
                step="0.01"
                value={formData.reorder_point}
                onChange={(e) => setFormData({ ...formData, reorder_point: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={isFieldDisabled}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
