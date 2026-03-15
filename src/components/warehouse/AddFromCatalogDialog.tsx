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
import { WarehouseItem } from '@/types/itemBin';

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
  const [selectedItem, setSelectedItem] = useState<WarehouseItem | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedBinId, setSelectedBinId] = useState<string>('');

  // Fetch all global items
  const { data: globalItems = [], isLoading: isLoadingGlobal } = useQuery({
    queryKey: ['global-catalog-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_items')
        .select('*')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data as WarehouseItem[];
    },
    enabled: open,
  });

  // Fetch existing item codes for current company
  const { data: existingCodes } = useQuery({
    queryKey: ['warehouse-items-codes', selectedCompany?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('warehouse_items')
        .select('item_code')
        .eq('company_id', selectedCompany!.id);
      return new Set(data?.map(d => d.item_code) || []);
    },
    enabled: open && !!selectedCompany?.id,
  });

  // Filter to only items NOT in current company
  const availableItems = useMemo(() => {
    return globalItems.filter(item => {
      if (item.company_id === selectedCompany?.id) return false;
      if (existingCodes?.has(item.item_code)) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(term) ||
        item.item_code.toLowerCase().includes(term) ||
        item.brand?.toLowerCase().includes(term) ||
        item.sku?.toLowerCase().includes(term)
      );
    });
  }, [globalItems, existingCodes, selectedCompany?.id, searchTerm]);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem || !selectedCompany?.id || !selectedBinId || quantity <= 0) {
        throw new Error('Please fill in all required fields');
      }

      // 1. Clone item into current company
      const { data: newItem, error: insertError } = await supabase
        .from('warehouse_items')
        .insert({
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
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 2. Create bin allocation
      await createAllocation({
        warehouse_item_id: newItem.id,
        bin_id: selectedBinId,
        allocated_quantity: quantity,
        company_id: selectedCompany.id,
      });

      return newItem;
    },
    onSuccess: () => {
      toast.success('Item imported to inventory with bin allocation');
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items-codes', selectedCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
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

  const handleSelectItem = (item: WarehouseItem) => {
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
            <ScrollArea className="h-[300px] border rounded-md">
              {isLoadingGlobal ? (
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
