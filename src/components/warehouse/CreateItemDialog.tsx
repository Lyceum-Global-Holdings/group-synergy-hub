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
import { Checkbox } from '@/components/ui/checkbox';
import { useWarehouseItems } from '@/hooks/useWarehouseItems';
import { useItemCategories } from '@/hooks/useItemCategories';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useItemUnits } from '@/hooks/useItemUnits';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { useCompany } from '@/contexts/CompanyContext';
import { WarehouseItem } from '@/types/itemBin';

interface CreateItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: WarehouseItem | null;
}

export function CreateItemDialog({ open, onOpenChange, editingItem }: CreateItemDialogProps) {
  const [formData, setFormData] = useState({
    item_code: '',
    name: '',
    description: '',
    category_id: '',
    unit_id: '',
    brand: '',
    manufacturer: '',
    supplier_id: '',
    company_id: '',
    unit_cost: '',
    selling_price: '',
    reorder_level: '',
    min_stock_level: '',
    max_stock_level: '',
    barcode: '',
    sku: '',
    status: 'active' as 'active' | 'inactive' | 'discontinued',
    is_serialized: false,
    is_batch_tracked: false,
    notes: '',
  });
  const [initialStock, setInitialStock] = useState('');

  const { createItem, createItemAsync, updateItem, isCreating, isUpdating } = useWarehouseItems();
  const { categories } = useItemCategories();
  const { data: suppliers = [] } = useSuppliers();
  const { units } = useItemUnits();
  const { createTransaction } = useStockTransactions();
  const { companies, selectedCompany } = useCompany();

  useEffect(() => {
    if (editingItem) {
      setFormData({
        item_code: editingItem.item_code,
        name: editingItem.name,
        description: editingItem.description || '',
        category_id: editingItem.category_id || '',
        unit_id: editingItem.unit_id || '',
        brand: editingItem.brand || '',
        manufacturer: editingItem.manufacturer || '',
        supplier_id: editingItem.supplier_id || '',
        company_id: editingItem.company_id || '',
        unit_cost: editingItem.unit_cost?.toString() || '',
        selling_price: editingItem.selling_price?.toString() || '',
        reorder_level: editingItem.reorder_level?.toString() || '',
        min_stock_level: editingItem.min_stock_level?.toString() || '',
        max_stock_level: editingItem.max_stock_level?.toString() || '',
        barcode: editingItem.barcode || '',
        sku: editingItem.sku || '',
        status: editingItem.status,
        is_serialized: editingItem.is_serialized,
        is_batch_tracked: editingItem.is_batch_tracked,
        notes: editingItem.notes || '',
      });
      setInitialStock(''); // Don't show current stock when editing
    } else {
      setFormData({
        item_code: '',
        name: '',
        description: '',
        category_id: '',
        unit_id: '',
        brand: '',
        manufacturer: '',
        supplier_id: '',
        company_id: selectedCompany?.id || '',
        unit_cost: '',
        selling_price: '',
        reorder_level: '',
        min_stock_level: '',
        max_stock_level: '',
        barcode: '',
        sku: '',
        status: 'active',
        is_serialized: false,
        is_batch_tracked: false,
        notes: '',
      });
      setInitialStock('');
    }
  }, [editingItem, open, selectedCompany?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submission - editingItem:', editingItem);
    console.log('Form data before processing:', formData);
    
    const baseData = {
      ...formData,
      unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : undefined,
      selling_price: formData.selling_price ? parseFloat(formData.selling_price) : undefined,
      reorder_level: formData.reorder_level ? parseFloat(formData.reorder_level) : undefined,
      min_stock_level: formData.min_stock_level ? parseFloat(formData.min_stock_level) : undefined,
      max_stock_level: formData.max_stock_level ? parseFloat(formData.max_stock_level) : undefined,
      category_id: formData.category_id || undefined,
      unit_id: formData.unit_id || undefined,
      supplier_id: formData.supplier_id || undefined,
      company_id: formData.company_id || null, // Convert empty string to null for proper database storage
    };

    if (editingItem) {
      // For updates, don't include current_stock to prevent overwriting it
      console.log('Update data being sent:', { id: editingItem.id, ...baseData });
      updateItem({ id: editingItem.id, ...baseData });
      onOpenChange(false);
    } else {
      // For new items, include initial stock
      const createData = {
        ...baseData,
        current_stock: 0, // Will be updated by stock transaction
      };
      console.log('Create data being sent:', createData);
      try {
        const result = await createItemAsync({
          ...createData,
          initialStock: initialStock ? parseFloat(initialStock) : undefined,
          initialUnitCost: formData.unit_cost ? parseFloat(formData.unit_cost) : undefined,
        });

        // Create opening stock transaction if initial stock provided
        if (initialStock && parseFloat(initialStock) > 0) {
          const stockQuantity = parseFloat(initialStock);
          const unitCostValue = formData.unit_cost ? parseFloat(formData.unit_cost) : 0;
          
          createTransaction({
            item_id: result.item.id,
            transaction_type: 'opening_stock',
            reference_type: 'manual',
            quantity_change: stockQuantity,
            quantity_before: 0,
            quantity_after: stockQuantity,
            unit_cost: unitCostValue > 0 ? unitCostValue : undefined,
            total_value: unitCostValue > 0 ? unitCostValue * stockQuantity : undefined,
            notes: 'Opening stock balance',
          });
        }
        
        onOpenChange(false);
      } catch (error) {
        console.error('Error creating item:', error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? 'Edit Item' : 'Create New Item'}
          </DialogTitle>
          <DialogDescription>
            {editingItem ? 'Update the item details below.' : 'Add a new item to your inventory.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item_code">Item Code *</Label>
              <Input
                id="item_code"
                value={formData.item_code}
                onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Item Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category_id">Category</Label>
              <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_id">Unit of Measure</Label>
              <Select value={formData.unit_id} onValueChange={(value) => setFormData({ ...formData, unit_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name} ({unit.abbreviation})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier_id">Supplier</Label>
              <Select value={formData.supplier_id} onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_id">Company Allocation</Label>
            <Select 
              value={formData.company_id || "all"} 
              onValueChange={(value) => {
                console.log('Company selection changed to:', value);
                setFormData({ ...formData, company_id: value === "all" ? "" : value });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select company allocation" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unit_cost">Unit Cost</Label>
              <Input
                id="unit_cost"
                type="number"
                step="0.01"
                value={formData.unit_cost}
                onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
              />
            </div>
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
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reorder_level">Reorder Level</Label>
              <Input
                id="reorder_level"
                type="number"
                value={formData.reorder_level}
                onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="min_stock_level">Min Stock</Label>
              <Input
                id="min_stock_level"
                type="number"
                value={formData.min_stock_level}
                onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_stock_level">Max Stock</Label>
              <Input
                id="max_stock_level"
                type="number"
                value={formData.max_stock_level}
                onChange={(e) => setFormData({ ...formData, max_stock_level: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              />
            </div>
          </div>

          {!editingItem && (
            <div className="space-y-2">
              <Label htmlFor="initial_stock">Initial Stock (Opening Balance)</Label>
              <Input
                id="initial_stock"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter opening stock quantity"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
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

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_serialized"
                checked={formData.is_serialized}
                onCheckedChange={(checked) => setFormData({ ...formData, is_serialized: !!checked })}
              />
              <Label htmlFor="is_serialized">Serialized Item</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_batch_tracked"
                checked={formData.is_batch_tracked}
                onCheckedChange={(checked) => setFormData({ ...formData, is_batch_tracked: !!checked })}
              />
              <Label htmlFor="is_batch_tracked">Batch Tracked</Label>
            </div>
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

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || isUpdating}>
              {editingItem ? 'Update Item' : 'Create Item'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}