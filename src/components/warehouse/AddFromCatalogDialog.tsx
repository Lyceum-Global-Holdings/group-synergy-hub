import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, PackagePlus, ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useWarehouseBins } from '@/hooks/useWarehouseBins';
import { useWarehouseBinAllocations } from '@/hooks/useWarehouseBinAllocations';
import { useItemCategories } from '@/hooks/useItemCategories';
import { toast } from 'sonner';
import { CatalogItem } from '@/types/itemBin';

interface AddFromCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFromCatalogDialog({ open, onOpenChange }: AddFromCatalogDialogProps) {
  const { selectedCompany } = useCompany();
  const { bins } = useWarehouseBins();
  const { createAllocation } = useWarehouseBinAllocations();
  const { categories } = useItemCategories(selectedCompany?.id);
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedBinId, setSelectedBinId] = useState<string>('');

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

  // Fetch existing catalog_item_ids using cursor-based batching
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
          .gt('current_stock', 0)
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

  // Filter to only items NOT already in current company's inventory
  const availableItems = useMemo(() => {
    return catalogItems.filter(item => {
      if (existingCatalogIds?.has(item.id)) return false;
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
      if (!selectedItem || !selectedCompany?.id || !selectedBinId || quantity <= 0) {
        throw new Error('Please fill in all required fields');
      }

      const userId = (await supabase.auth.getUser()).data.user?.id;

      // Check if an existing inventory row exists (even with 0 stock)
      const { data: existingRow } = await supabase
        .from('warehouse_items')
        .select('id')
        .eq('company_id', selectedCompany.id)
        .eq('catalog_item_id', selectedItem.id)
        .maybeSingle();

      let itemId: string;

      if (existingRow) {
        // Reactivate existing row
        const { data: updated, error: updateError } = await supabase
          .from('warehouse_items')
          .update({
            current_stock: quantity,
            reserved_quantity: 0,
            status: 'active',
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
          })
          .eq('id', existingRow.id)
          .select()
          .single();

        if (updateError) throw updateError;
        itemId = updated.id;
      } else {
        // Fresh insert
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
            current_stock: quantity,
            reserved_quantity: 0,
            created_by: userId,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        itemId = newItem.id;
      }

      // Create bin allocation
      await createAllocation({
        warehouse_item_id: itemId,
        bin_id: selectedBinId,
        allocated_quantity: quantity,
        company_id: selectedCompany.id,
      });

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
    setQuantity(1);
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
      <DialogContent className="sm:max-w-lg">
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
            <ScrollArea className="h-[400px] border rounded-md">
              {isLoadingCatalog ? (
                <div className="p-4 text-center text-muted-foreground">Loading catalog...</div>
              ) : availableItems.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {searchTerm ? 'No matching items found' : 'All catalog items are already in your inventory'}
                </div>
              ) : (
                <div className="divide-y">
                  {availableItems.map(item => (
                    <button
                      key={item.id}
                      className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-center justify-between gap-2"
                      onClick={() => handleSelectItem(item)}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{item.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="font-mono">{item.item_code}</span>
                          {item.brand && <span>• {item.brand}</span>}
                          <span>• {categoryName(item.category_id)}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">Select</Badge>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              Showing {availableItems.length} item{availableItems.length !== 1 ? 's' : ''} not yet in your inventory
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
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bin">Assign to Bin *</Label>
                <Select value={selectedBinId} onValueChange={setSelectedBinId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a bin" />
                  </SelectTrigger>
                  <SelectContent>
                    {bins.map(bin => (
                      <SelectItem key={bin.id} value={bin.id}>
                        {bin.bin_code} {bin.name ? `- ${bin.name}` : ''}
                      </SelectItem>
                    ))}
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
              disabled={importMutation.isPending || !selectedBinId || quantity <= 0}
            >
              {importMutation.isPending ? 'Importing...' : 'Import to Inventory'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
