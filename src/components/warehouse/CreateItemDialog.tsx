import { useState, useEffect, useMemo } from 'react';
import { QTY_STEP, QTY_MIN } from '@/lib/quantityInput';
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
import { useApprovedCompanySuppliers } from '@/hooks/useCompanySuppliers';
import { useItemUnits } from '@/hooks/useItemUnits';
import { useStockTransactions } from '@/hooks/useStockTransactions';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { useWarehouseBinAllocations } from '@/hooks/useWarehouseBinAllocations';
import { useCompany } from '@/contexts/CompanyContext';
import { buildLocationOptions, locationTypeLabel } from '@/lib/warehouse/locationHierarchy';
import { WarehouseItem } from '@/types/itemBin';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { QuickCreateSupplierDialog } from './QuickCreateSupplierDialog';
import { useNextWarehouseItemCode } from '@/hooks/warehouse/useNextWarehouseItemCode';

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
    location_id: '',
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
    track_secondary_quantity: false,
    secondary_uom: '',
    notes: '',
    image_url: '',
  });
  const [initialStock, setInitialStock] = useState('');
  const [initialStockSecondary, setInitialStockSecondary] = useState('');
  const [initialBinId, setInitialBinId] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isQuickSupplierDialogOpen, setIsQuickSupplierDialogOpen] = useState(false);

  const { createItem, createItemAsync, updateItem, isCreating, isUpdating } = useWarehouseItems();
  const { companies, selectedCompany } = useCompany();
  const { categories } = useItemCategories(selectedCompany?.id);
  const { data: companySuppliers = [], refetch: refetchSuppliers } = useApprovedCompanySuppliers(selectedCompany?.id);
  const suppliers = companySuppliers.map(cs => cs.supplier).filter(Boolean);
  const { units } = useItemUnits();
  const { createTransaction } = useStockTransactions();
  const { locations } = useWarehouseLocations();
  const { bins } = useWarehouseBins();
  const { createAllocation } = useWarehouseBinAllocations();

  // Filter locations to only show warehouses (type='location')
  const warehouseLocations = locations.filter(loc => loc.type === 'location');
  const topLevelCategories = useMemo(() => categories.filter(c => !c.parent_id), [categories]);

  const selectedCategory = useMemo(() => 
    topLevelCategories.find(c => c.id === formData.category_id), 
    [topLevelCategories, formData.category_id]
  );
  const { data: nextItemCode, isLoading: isLoadingCode } = useNextWarehouseItemCode(
    selectedCategory?.code || null,
    selectedCompany?.id || null
  );

  useEffect(() => {
    if (!editingItem && nextItemCode) {
      setFormData(prev => ({ ...prev, item_code: nextItemCode }));
    }
  }, [nextItemCode, editingItem]);

  // Filter bins by selected warehouse location
  const filteredBins = formData.location_id 
    ? bins.filter(bin => bin.location_id === formData.location_id)
    : bins;

  const handleSupplierCreated = async (supplierId: string) => {
    await refetchSuppliers();
    setFormData(prev => ({ ...prev, supplier_id: supplierId }));
  };

  useEffect(() => {
    if (editingItem) {
      setFormData({
        item_code: editingItem.item_code,
        name: editingItem.name,
        description: editingItem.description || '',
        category_id: editingItem.category_id || '',
        unit_id: editingItem.unit_id || '',
        location_id: editingItem.location_id || '',
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
        track_secondary_quantity: editingItem.track_secondary_quantity ?? false,
        secondary_uom: editingItem.secondary_uom ?? '',
        notes: editingItem.notes || '',
        image_url: editingItem.image_url || '',
      });
      setInitialStock('');
      setInitialStockSecondary('');
      setInitialBinId('');
      setImagePreview(editingItem.image_url || null);
      setImageFile(null);
    } else {
      setFormData({
        item_code: '',
        name: '',
        description: '',
        category_id: '',
        unit_id: '',
        location_id: '',
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
        track_secondary_quantity: false,
        secondary_uom: '',
        notes: '',
        image_url: '',
      });
      setInitialStock('');
      setInitialStockSecondary('');
      setInitialBinId('');
      setImagePreview(null);
      setImageFile(null);
    }
  }, [editingItem, open, selectedCompany?.id]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData({ ...formData, image_url: '' });
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return formData.image_url || null;

    setUploading(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `items/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('item-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Upload image first if there's a new file
    let imageUrl = formData.image_url;
    if (imageFile) {
      const uploadedUrl = await uploadImage();
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      }
    }
    
    const baseData = {
      ...formData,
      image_url: imageUrl || undefined,
      unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : undefined,
      selling_price: formData.selling_price ? parseFloat(formData.selling_price) : undefined,
      reorder_level: formData.reorder_level ? parseFloat(formData.reorder_level) : undefined,
      min_stock_level: formData.min_stock_level ? parseFloat(formData.min_stock_level) : undefined,
      max_stock_level: formData.max_stock_level ? parseFloat(formData.max_stock_level) : undefined,
      category_id: formData.category_id || undefined,
      unit_id: formData.unit_id || undefined,
      location_id: formData.location_id || undefined,
      supplier_id: formData.supplier_id || undefined,
      company_id: formData.company_id || null,
      sku: formData.sku.trim() || null,
      barcode: formData.barcode.trim() || null,
      track_secondary_quantity: formData.track_secondary_quantity,
      secondary_uom: formData.track_secondary_quantity
        ? (formData.secondary_uom.trim() || null)
        : null,
    };

    if (editingItem) {
      updateItem({ id: editingItem.id, ...baseData });
      onOpenChange(false);
    } else {
      const createData = {
        ...baseData,
        current_stock: 0,
      };
      try {
        const result = await createItemAsync({
          ...createData,
          initialStock: initialStock ? parseFloat(initialStock) : undefined,
          initialUnitCost: formData.unit_cost ? parseFloat(formData.unit_cost) : undefined,
        });

        if (initialStock && parseFloat(initialStock) > 0) {
          const stockQuantity = parseFloat(initialStock);
          const secondaryQty = formData.track_secondary_quantity && initialStockSecondary
            ? parseFloat(initialStockSecondary)
            : undefined;
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
            ...(secondaryQty !== undefined ? { secondary_quantity_change: secondaryQty } : {}),
          });

          // Create bin allocation if a bin is selected
          if (initialBinId) {
            createAllocation({
              warehouse_item_id: result.item.id,
              bin_id: initialBinId,
              allocated_quantity: stockQuantity,
              notes: 'Opening stock allocation',
              ...(secondaryQty !== undefined ? { secondary_quantity: secondaryQty } : {}),
            });
          }
        }

        onOpenChange(false);
      } catch (error) {
        console.error('Error creating item:', error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
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
                readOnly={!editingItem}
                placeholder={!editingItem ? 'Select category to auto-generate' : ''}
                className={!editingItem ? 'bg-muted cursor-not-allowed' : ''}
              />
              {!editingItem && (
                <p className="text-xs text-muted-foreground">
                  {isLoadingCode ? 'Generating...' : 'Auto-generated: INV-{Category}-Sequence'}
                </p>
              )}
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

          {/* Product Image Upload */}
          <div className="space-y-2">
            <Label>Product Image</Label>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Item preview"
                      className="h-20 w-20 rounded-md object-cover border border-border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-md border border-dashed border-border flex items-center justify-center bg-muted">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG or WEBP (max 5MB)
                </p>
              </div>
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
              <Label htmlFor="category_id" title="SAP MM Material Group — only top-level categories are used for item classification">Material Group (Level 1)</Label>
              <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select material group" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  {topLevelCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.code ? `[${category.code}] ${category.name}` : category.name}
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
              <Select 
                value={formData.supplier_id} 
                onValueChange={(value) => {
                  if (value === '__create_new__') {
                    setIsQuickSupplierDialogOpen(true);
                  } else {
                    setFormData({ ...formData, supplier_id: value });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="__create_new__" className="text-primary font-medium">
                    <span className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Create New Supplier
                    </span>
                  </SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location_id">Warehouse Location</Label>
              <Select 
                value={formData.location_id || "none"} 
                onValueChange={(value) => {
                  setFormData({ ...formData, location_id: value === "none" ? "" : value });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="none">No Warehouse</SelectItem>
                  {warehouseLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} {location.location_code ? `(${location.location_code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_id">Company Allocation</Label>
              <Select 
                value={formData.company_id || "all"} 
                onValueChange={(value) => {
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
            <>
              <div className="space-y-2">
                <Label htmlFor="initial_stock">Initial Stock (Opening Balance)</Label>
                <Input
                  id="initial_stock"
                  type="number"
                  step={QTY_STEP}
                  min={QTY_MIN}
                  inputMode="decimal"
                  placeholder="e.g. 12.500"
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Decimals supported (up to 3 places, e.g. 12.5 kg, 0.750 m).
                </p>
              </div>

              {formData.track_secondary_quantity && (
                <div className="space-y-2">
                  <Label htmlFor="initial_stock_secondary">
                    Initial Pieces {formData.secondary_uom ? `(${formData.secondary_uom})` : ''}
                  </Label>
                  <Input
                    id="initial_stock_secondary"
                    type="number"
                    step={QTY_STEP}
                    min={QTY_MIN}
                    inputMode="decimal"
                    placeholder="e.g. 18"
                    value={initialStockSecondary}
                    onChange={(e) => setInitialStockSecondary(e.target.value)}
                  />
                </div>
              )}

              {initialStock && parseFloat(initialStock) > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="initial_bin_id">Allocate Initial Stock to Bin</Label>
                  <Select 
                    value={initialBinId || "none"} 
                    onValueChange={(value) => setInitialBinId(value === "none" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bin for initial stock" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      <SelectItem value="none">No Bin Allocation</SelectItem>
                      {filteredBins.map((bin) => (
                        <SelectItem key={bin.id} value={bin.id}>
                          {bin.bin_code} - {bin.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Optional: Select a bin to allocate the opening stock
                  </p>
                </div>
              )}
            </>
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

          <div className="rounded-md border border-border p-4 space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="track_secondary_quantity"
                checked={formData.track_secondary_quantity}
                onCheckedChange={(checked) => setFormData({ ...formData, track_secondary_quantity: !!checked })}
              />
              <Label htmlFor="track_secondary_quantity" className="font-medium">
                Track pieces separately from base unit
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Use when items are received in a counted unit (e.g. pieces, rolls, bags) but
              valued in a different base unit (e.g. metres, kg). Conversion is captured
              per receipt — no fixed factor needed.
            </p>
            {formData.track_secondary_quantity && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Base UOM</Label>
                  <Input
                    value={units.find(u => u.id === formData.unit_id)?.abbreviation || ''}
                    placeholder="Set Unit of Measure above"
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="secondary_uom" className="text-xs">Secondary UOM *</Label>
                  <Input
                    id="secondary_uom"
                    value={formData.secondary_uom}
                    onChange={(e) => setFormData({ ...formData, secondary_uom: e.target.value })}
                    placeholder="e.g. pcs, roll, bag"
                    required={formData.track_secondary_quantity}
                  />
                </div>
              </div>
            )}
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
            <Button type="submit" disabled={isCreating || isUpdating || uploading}>
              {uploading ? 'Uploading...' : editingItem ? 'Update Item' : 'Create Item'}
            </Button>
          </div>
        </form>

        <QuickCreateSupplierDialog
          open={isQuickSupplierDialogOpen}
          onOpenChange={setIsQuickSupplierDialogOpen}
          onSupplierCreated={handleSupplierCreated}
        />
      </DialogContent>
    </Dialog>
  );
}