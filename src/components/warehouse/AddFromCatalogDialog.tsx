import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, PackagePlus, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useItemCategories } from '@/hooks/useItemCategories';
import { useLocationFilter } from '@/contexts/LocationFilterContext';
import { buildLocationOptions, getRootLocationId } from '@/lib/warehouse/locationHierarchy';
import { toast } from 'sonner';
import { CatalogItem } from '@/types/itemBin';
import { QTY_STEP, QTY_MIN, parseQty } from '@/lib/quantityInput';

interface AddFromCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFromCatalogDialog({ open, onOpenChange }: AddFromCatalogDialogProps) {
  const { selectedCompany } = useCompany();
  const { bins } = useWarehouseBins();
  const { locations } = useWarehouseLocations();
  const { globalLocationId } = useLocationFilter();
  const { categories } = useItemCategories(selectedCompany?.id);
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [quantity, setQuantity] = useState<string>('1');
  const [selectedBinId, setSelectedBinId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  const locationOptions = useMemo(() => buildLocationOptions(locations, { activeOnly: true }), [locations]);
  const effectiveLocationId = selectedLocationId || globalLocationId || '';
  const selectedRootLocationId = useMemo(
    () => getRootLocationId(locations, effectiveLocationId),
    [locations, effectiveLocationId]
  );
  const filteredBins = effectiveLocationId
    ? bins.filter((bin) => (bin.root_location_id ?? bin.location_id) === selectedRootLocationId)
    : bins;

  // Fetch all catalog items using cursor-based batching to bypass 1,000-row limit
  const { data: catalogItems = [], isLoading: isLoadingCatalog } = useQuery({
    queryKey: ['warehouse-item-catalog-for-import'],
    queryFn: async () => {
      const batchSize = 1000;
      const allItems: CatalogItem[] = [];
      let lastId: string | null = null;

      while (true) {
        let q = supabase
          .from('warehouse_item_catalog')
          .select('*')
          .eq('status', 'active')
          .order('id')
          .limit(batchSize);

        if (lastId) {
          q = q.gt('id', lastId);
        }

        const { data, error } = await q;
        if (error) throw error;

        const batch = (data || []) as unknown as CatalogItem[];
        allItems.push(...batch);

        if (batch.length < batchSize) break;
        lastId = batch[batch.length - 1].id;
      }

      // Sort by name client-side for display
      allItems.sort((a, b) => a.name.localeCompare(b.name));
      return allItems;
    },
    enabled: open,
  });

  // Fetch existing catalog_item_ids in this company so we can badge them
  // (no longer used to hide rows — same item can live in multiple bins/locations).
  const { data: existingCatalogIds } = useQuery({
    queryKey: ['warehouse-items-catalog-ids', selectedCompany?.id],
    queryFn: async () => {
      const batchSize = 1000;
      const allIds: string[] = [];
      let lastId: string | null = null;

      while (true) {
        let q = supabase
          .from('warehouse_items')
          .select('id, catalog_item_id')
          .eq('company_id', selectedCompany!.id)
          .not('catalog_item_id', 'is', null)
          .order('id')
          .limit(batchSize);

        if (lastId) {
          q = q.gt('id', lastId);
        }

        const { data, error } = await q;
        if (error) throw error;

        const batch = data || [];
        for (const d of batch) {
          if (d.catalog_item_id) allIds.push(d.catalog_item_id);
        }

        if (batch.length < batchSize) break;
        lastId = batch[batch.length - 1].id;
      }

      return new Set(allIds);
    },
    enabled: open && !!selectedCompany?.id,
  });

  // Show ALL active catalog items. Items already in this company's inventory
  // remain selectable so users can allocate the same item to additional bins
  // (international WMS standard: 1 item × N bins × N locations per company).
  const availableItems = useMemo(() => {
    return catalogItems.filter(item => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(term) ||
        item.item_code.toLowerCase().includes(term) ||
        item.brand?.toLowerCase().includes(term) ||
        item.sku?.toLowerCase().includes(term)
      );
    });
  }, [catalogItems, existingCatalogIds, searchTerm]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const qty = parseQty(quantity);
      if (!selectedItem || !selectedCompany?.id || !effectiveLocationId || !selectedBinId || !qty || qty <= 0) {
        throw new Error('Please fill in all required fields with a valid quantity');
      }

      const userId = (await supabase.auth.getUser()).data.user?.id;

      // Look for existing inventory row in this company for this catalog item.
      const { data: existingRow } = await supabase
        .from('warehouse_items')
        .select('id, current_stock, location_id')
        .eq('company_id', selectedCompany.id)
        .or(`catalog_item_id.eq.${selectedItem.id},item_code.eq.${selectedItem.item_code}`)
        .maybeSingle();

      let itemId: string;

      if (existingRow) {
        // Item already exists in this company → ADD to stock (do not overwrite),
        // so the same item can live across multiple bins/locations.
        const newStock = Number(existingRow.current_stock || 0) + qty;
        const { data: updated, error: updateError } = await supabase
          .from('warehouse_items')
          .update({
            current_stock: newStock,
            status: 'active',
            ...(existingRow.location_id ? {} : { location_id: effectiveLocationId }),
          })
          .eq('id', existingRow.id)
          .select('id')
          .single();

        if (updateError) throw updateError;
        itemId = updated.id;
      } else {
        // Fresh insert (first time this catalog item lands in this company)
        const { data: newItem, error: insertError } = await supabase
          .from('warehouse_items')
          .insert({
            catalog_item_id: selectedItem.id,
            item_code: selectedItem.item_code,
            name: selectedItem.name,
            description: selectedItem.description,
            category_id: selectedItem.category_id,
            unit_id: selectedItem.unit_id,
            brand: selectedItem.brand,
            manufacturer: selectedItem.manufacturer,
            barcode: selectedItem.barcode,
            sku: selectedItem.sku,
            unit_cost: selectedItem.unit_cost,
            selling_price: selectedItem.selling_price,
            reorder_level: selectedItem.reorder_level,
            min_stock_level: selectedItem.min_stock_level,
            max_stock_level: selectedItem.max_stock_level,
            image_url: selectedItem.image_url,
            is_batch_tracked: selectedItem.is_batch_tracked,
            is_serialized: selectedItem.is_serialized,
            status: 'active',
            company_id: selectedCompany.id,
            location_id: effectiveLocationId,
            current_stock: qty,
            reserved_quantity: 0,
            created_by: userId,
          } as any)
          .select()
          .single();

        if (insertError) throw insertError;
        itemId = newItem.id;
      }

      // Upsert bin allocation on (warehouse_item_id, bin_id, company_id, location_id).
      // If allocation already exists, increment allocated_quantity.
      const { data: existingAlloc } = await supabase
        .from('warehouse_bin_allocations')
        .select('id, allocated_quantity')
        .eq('warehouse_item_id', itemId)
        .eq('bin_id', selectedBinId)
        .eq('company_id', selectedCompany.id)
        .eq('location_id', effectiveLocationId)
        .maybeSingle();

      if (existingAlloc) {
        const newAlloc = Number(existingAlloc.allocated_quantity || 0) + qty;
        const { error: allocUpdateError } = await supabase
          .from('warehouse_bin_allocations')
          .update({ allocated_quantity: newAlloc })
          .eq('id', existingAlloc.id);
        if (allocUpdateError) throw allocUpdateError;
      } else {
        const { error: allocInsertError } = await supabase
          .from('warehouse_bin_allocations')
          .insert({
            warehouse_item_id: itemId,
            bin_id: selectedBinId,
            allocated_quantity: qty,
            reserved_quantity: 0,
            company_id: selectedCompany.id,
            location_id: effectiveLocationId,
            created_by: userId,
          });
        if (allocInsertError) throw allocInsertError;
      }

      return { id: itemId };
    },
    onSuccess: () => {
      toast.success('Item imported to inventory with bin allocation');
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items-catalog-ids', selectedCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items-inventory'] });
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to import item');
    },
  });

  const handleClose = () => {
    setStep('select');
    setSearchTerm('');
    setSelectedItem(null);
    setQuantity('1');
    setSelectedLocationId('');
    setSelectedBinId('');
    onOpenChange(false);
  };

  const handleSelectItem = (item: CatalogItem) => {
    setSelectedItem(item);
    setStep('configure');
  };

  const categoryName = (id: string | null) => categories.find(c => c.id === id)?.name || '-';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            {step === 'select' ? 'Import from Catalog' : 'Set Quantity & Bin'}
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items by name, code, brand..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <ScrollArea className="h-[400px] border rounded-md overflow-hidden">
              {isLoadingCatalog ? (
                <div className="p-4 text-center text-muted-foreground">Loading catalog...</div>
              ) : availableItems.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {searchTerm ? 'No matching items found' : 'No active catalog items found'}
                </div>
              ) : (
                <div className="overflow-hidden">
                  {availableItems.map(item => {
                    const alreadyInInventory = existingCatalogIds?.has(item.id);
                    return (
                      <button
                        key={item.id}
                        className="w-full block text-left px-4 py-3 hover:bg-accent transition-colors border-b last:border-b-0 cursor-pointer overflow-hidden box-border"
                        onClick={() => handleSelectItem(item)}
                      >
                        <div className="flex w-full items-start gap-3">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="font-medium text-sm break-words text-foreground">{item.name}</div>
                            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-mono bg-muted px-1 rounded text-[10px]">{item.item_code}</span>
                              {item.brand && <span className="break-words">• {item.brand}</span>}
                              <span className="break-words">• {categoryName(item.category_id)}</span>
                            </div>
                            {alreadyInInventory && (
                              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-0.5">
                                <CheckCircle2 className="h-3 w-3" />
                                Already in inventory — selecting will add stock to another bin
                              </div>
                            )}
                          </div>
                          <Badge
                            variant={alreadyInInventory ? 'outline' : 'secondary'}
                            className="shrink-0 text-[10px] mt-0.5"
                          >
                            {alreadyInInventory ? 'Add to bin' : 'Select'}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              Showing {availableItems.length} catalog item{availableItems.length !== 1 ? 's' : ''}. Same item can be allocated to multiple bins and locations within a company.
            </p>
          </div>
        )}

        {step === 'configure' && selectedItem && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep('select')} className="mb-1 -ml-2">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to search
            </Button>

            <div className="bg-muted/50 rounded-md p-3 space-y-1">
              <div className="font-medium">{selectedItem.name}</div>
              <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                <span className="font-mono">{selectedItem.item_code}</span>
                {selectedItem.brand && <span>• {selectedItem.brand}</span>}
                <span>• {categoryName(selectedItem.category_id)}</span>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Initial Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step={QTY_STEP}
                  min={QTY_MIN}
                  inputMode="decimal"
                  placeholder="e.g. 12.500"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Decimals supported (up to 3 places, e.g. 12.5 kg, 0.750 m).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Stock Location *</Label>
                <Select
                  value={effectiveLocationId}
                  onValueChange={(value) => {
                    setSelectedLocationId(value);
                    setSelectedBinId('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationOptions.map(({ location, depth, breadcrumb }) => (
                      <SelectItem key={location.id} value={location.id}>
                        <span style={{ paddingInlineStart: `${depth * 12}px` }}>{breadcrumb}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bin">Assign to Bin *</Label>
                <Select value={selectedBinId} onValueChange={setSelectedBinId} disabled={!effectiveLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder={effectiveLocationId ? 'Select a bin' : 'Select location first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredBins.map(bin => {
                      const showName = bin.name && bin.name.toLowerCase() !== bin.bin_code.toLowerCase();
                      return (
                        <SelectItem key={bin.id} value={bin.id}>
                          <span className="font-mono">{bin.bin_code}</span>
                          {showName ? <span className="text-muted-foreground"> · {bin.name}</span> : null}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 'configure' && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || !effectiveLocationId || !selectedBinId || !parseQty(quantity) || (parseQty(quantity) ?? 0) <= 0}
            >
              {importMutation.isPending ? 'Importing...' : 'Import to Inventory'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
