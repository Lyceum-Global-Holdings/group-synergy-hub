import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Plus, Eye, History, Package, MapPin, X, Image as ImageIcon, Edit, Trash2, Download, Loader2, Columns3 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useWarehouseItemCatalog } from '@/hooks/useWarehouseItemCatalog';
import { useWarehouseItemsLazy, useWarehouseItemsCount, fetchAllWarehouseItemsBatched } from '@/hooks/useWarehouseItemsPaged';
import { useItemCategories } from '@/hooks/useItemCategories';
import { useItemUnits } from '@/hooks/useItemUnits';
import { useCompany } from '@/contexts/CompanyContext';
const AddItemsDialog = lazy(() =>
  import('@/components/warehouse/AddItemsDialog').then(m => ({ default: m.AddItemsDialog }))
);
const StockMovementDialog = lazy(() =>
  import('@/components/warehouse/StockMovementDialog').then(m => ({ default: m.StockMovementDialog }))
);
const DeleteItemConfirmationDialog = lazy(() =>
  import('@/components/warehouse/DeleteItemConfirmationDialog').then(m => ({ default: m.DeleteItemConfirmationDialog }))
);
const ItemDetailsDialog = lazy(() =>
  import('@/components/warehouse/ItemDetailsDialog').then(m => ({ default: m.ItemDetailsDialog }))
);
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';
import { CatalogItem } from '@/types/itemBin';

const COLUMN_DEFS = [
  { key: 'photo', label: 'Photo', fixed: false },
  { key: 'item_code', label: 'Item Code', fixed: false },
  { key: 'name', label: 'Name', fixed: true },
  { key: 'category', label: 'Category', fixed: false },
  { key: 'unit', label: 'Unit', fixed: false },
  { key: 'unit_cost', label: 'Unit Cost', fixed: false },
  { key: 'selling_price', label: 'Selling Price', fixed: false },
  { key: 'reorder_level', label: 'Reorder Lvl', fixed: false },
  { key: 'status', label: 'Status', fixed: false },
  { key: 'actions', label: 'Actions', fixed: true },
] as const;

type ColumnKey = typeof COLUMN_DEFS[number]['key'];

const DEFAULT_VISIBLE: Record<ColumnKey, boolean> = Object.fromEntries(
  COLUMN_DEFS.map(c => [c.key, true])
) as Record<ColumnKey, boolean>;

interface ItemMasterDefinitionTabProps {
  onNavigateToInventory?: (itemId?: string) => void;
  onNavigateToBins?: (itemId?: string) => void;
}

export function ItemMasterDefinitionTab({ onNavigateToInventory, onNavigateToBins }: ItemMasterDefinitionTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [stockMovementItem, setStockMovementItem] = useState<CatalogItem | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(DEFAULT_VISIBLE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const col = (key: ColumnKey) => visibleColumns[key];
  const visibleCount = Object.values(visibleColumns).filter(Boolean).length;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Use catalog mutations (disable list fetch since we use paged hook)
  const { deleteItem, markItemInactive, isDeleting, isMarkingInactive } = useWarehouseItemCatalog({ disableFetch: true });
  const { canDelete } = useIsAdminOrHigher();
  const { selectedCompany } = useCompany();
  const { categories } = useItemCategories(selectedCompany?.id);
  const { units } = useItemUnits();
  const queryClient = useQueryClient();

  const { data: suppliers = [] } = useQuery({
    queryKey: ['all-supplier-names'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const selectedSupplierId = useMemo(() => {
    if (supplierFilter === 'all') return 'all';
    return suppliers.find(s => s.name === supplierFilter)?.id || 'all';
  }, [supplierFilter, suppliers]);

  const categoryOptions = useMemo(() => {
    const level0 = categories.filter(c => !c.parent_id);
    const result: Array<{ category: typeof categories[number]; depth: 0 | 1 }> = [];
    level0
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(parent => {
        result.push({ category: parent, depth: 0 });
        categories
          .filter(c => c.parent_id === parent.id)
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach(child => result.push({ category: child, depth: 1 }));
      });
    return result;
  }, [categories]);

  const selectedCategoryId = categoryFilter;

  const filterParams = { search: debouncedSearch, categoryId: selectedCategoryId, status: statusFilter, supplierId: selectedSupplierId };

  const {
    data: infiniteData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useWarehouseItemsLazy(filterParams);

  const countConfig = useWarehouseItemsCount(filterParams);
  const { data: totalCount = 0 } = useQuery(countConfig);

  const items = useMemo(() => {
    if (!infiniteData?.pages) return [];
    const seen = new Set<string>();
    const result: CatalogItem[] = [];
    for (const page of infiniteData.pages) {
      for (const item of page.items) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          result.push(item);
        }
      }
    }
    return result;
  }, [infiniteData]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const hasActiveFilters = categoryFilter !== 'all' || statusFilter !== 'all' || supplierFilter !== 'all';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'discontinued': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleDownloadExcel = useCallback(async () => {
    setIsExporting(true);
    try {
      toast.info('Fetching all items for export...');
      const allItems = await fetchAllWarehouseItemsBatched({
        search: debouncedSearch,
        categoryId: selectedCategoryId,
        status: statusFilter,
        supplierId: selectedSupplierId,
      });

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Item Master');

      sheet.columns = [
        { header: 'Item Code', key: 'item_code', width: 15 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Category', key: 'category', width: 15 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Brand', key: 'brand', width: 15 },
        { header: 'Supplier', key: 'supplier', width: 20 },
        { header: 'Barcode', key: 'barcode', width: 18 },
        { header: 'SKU', key: 'sku', width: 15 },
        { header: 'Unit Cost', key: 'unit_cost', width: 12 },
        { header: 'Selling Price', key: 'selling_price', width: 14 },
        { header: 'Reorder Level', key: 'reorder_level', width: 14 },
        { header: 'Status', key: 'status', width: 12 },
      ];

      sheet.getRow(1).font = { bold: true };

      allItems.forEach(item => {
        const cat = categories.find(c => c.id === item.category_id);
        sheet.addRow({
          item_code: item.item_code,
          name: item.name,
          category: cat?.name || '',
          unit: units.find(u => u.id === item.unit_id)?.name || '',
          brand: item.brand || '',
          supplier: item.supplier?.name || '',
          barcode: item.barcode || '',
          sku: item.sku || '',
          unit_cost: item.unit_cost ?? 0,
          selling_price: item.selling_price ?? 0,
          reorder_level: item.reorder_level ?? 0,
          status: item.status,
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Item_Master_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${allItems.length} items`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export items');
    } finally {
      setIsExporting(false);
    }
  }, [debouncedSearch, selectedCategoryId, statusFilter, selectedSupplierId, categories, units]);

  return (
    <div className="space-y-4">

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items, SKU, barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-56"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoryOptions.map(({ category, depth }) => (
                  <SelectItem key={category.id} value={category.id}>
                    <span className={depth === 1 ? 'pl-4 text-muted-foreground' : 'font-medium'}>
                      {depth === 1 ? '└ ' : ''}
                      {category.code ? `[${category.code}] ${category.name}` : category.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="discontinued">Discontinued</SelectItem>
              </SelectContent>
            </Select>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Supplier" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={() => { setCategoryFilter('all'); setStatusFilter('all'); setSupplierFilter('all'); }}>
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="mr-2 h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 p-2 space-y-1">
                {COLUMN_DEFS.filter(c => !c.fixed).map(colDef => (
                  <label key={colDef.key} className="flex items-center gap-2 px-2 py-1 text-sm cursor-pointer hover:bg-accent rounded">
                    <Checkbox
                      checked={visibleColumns[colDef.key]}
                      onCheckedChange={() => toggleColumn(colDef.key)}
                    />
                    {colDef.label}
                  </label>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={handleDownloadExcel} disabled={isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isExporting ? 'Exporting...' : 'Download Excel'}
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table className="[&_td]:py-1.5 [&_th]:py-2">
          <TableHeader>
            <TableRow>
              {col('photo') && <TableHead className="w-10"></TableHead>}
              {col('item_code') && <TableHead>Item Code</TableHead>}
              <TableHead>Name</TableHead>
              {col('category') && <TableHead>Category</TableHead>}
              {col('unit') && <TableHead>Unit</TableHead>}
              {col('unit_cost') && <TableHead className="text-right">Unit Cost</TableHead>}
              {col('selling_price') && <TableHead className="text-right">Selling Price</TableHead>}
              {col('reorder_level') && <TableHead className="text-right">Reorder Lvl</TableHead>}
              {col('status') && <TableHead>Status</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={visibleCount} className="text-center py-8 text-muted-foreground">Loading items...</TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCount} className="text-center py-8 text-muted-foreground">No items found</TableCell>
              </TableRow>
            ) : items.map(item => {
              const category = categories.find(c => c.id === item.category_id);
              const unit = units.find(u => u.id === item.unit_id);
              return (
                <TableRow key={item.id}>
                  {col('photo') && (
                    <TableCell>
                      {item.image_url ? (
                        <button onClick={() => setPreviewImage({ url: item.image_url!, name: item.name })} className="cursor-pointer">
                          <img src={item.image_url} alt={item.name} className="h-7 w-7 rounded object-cover" />
                        </button>
                      ) : (
                        <div className="h-7 w-7 rounded bg-muted flex items-center justify-center">
                          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                  )}
                  {col('item_code') && <TableCell className="font-mono text-xs">{item.item_code}</TableCell>}
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="font-medium">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  {col('category') && <TableCell>{category?.name || '-'}</TableCell>}
                  {col('unit') && <TableCell>{unit?.abbreviation || '-'}</TableCell>}
                  {col('unit_cost') && <TableCell className="text-right">{item.unit_cost?.toFixed(2) || '-'}</TableCell>}
                  {col('selling_price') && <TableCell className="text-right">{item.selling_price?.toFixed(2) || '-'}</TableCell>}
                  {col('reorder_level') && <TableCell className="text-right">{item.reorder_level ?? '-'}</TableCell>}
                  {col('status') && (
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(item.status || 'active')}>
                        {item.status || 'active'}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem(item)}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit Item</TooltipContent>
                            </Tooltip>
                            {canDelete && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingItem(item)} disabled={isDeleting || isMarkingInactive}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete Item</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onNavigateToInventory?.(item.id)}>
                                  <Package className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View in Inventory</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onNavigateToBins?.(item.id)}>
                                  <MapPin className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Bin Allocations</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStockMovementItem(item)}>
                                  <History className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Stock Movement History</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="text-sm text-muted-foreground">
          Loaded {items.length.toLocaleString()} of {totalCount.toLocaleString()} items
        </div>
        <div ref={sentinelRef} className="h-1" />
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading more items...
          </div>
        )}
        {hasNextPage && !isFetchingNextPage && (
          <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
            Load more items
          </Button>
        )}
        {!hasNextPage && items.length > 0 && (
          <div className="text-sm text-muted-foreground">All items loaded</div>
        )}
      </div>

      {(isCreateDialogOpen || editingItem !== null) && (
        <Suspense fallback={null}>
          <AddItemsDialog
            open={isCreateDialogOpen || editingItem !== null}
            onOpenChange={(open) => {
              if (!open) { setIsCreateDialogOpen(false); setEditingItem(null); }
            }}
            editingItem={editingItem || undefined}
            mode="catalog"
          />
        </Suspense>
      )}

      {stockMovementItem && (
        <Suspense fallback={null}>
          <StockMovementDialog
            open={!!stockMovementItem}
            onOpenChange={(open) => { if (!open) setStockMovementItem(null); }}
            itemId={stockMovementItem.id}
            itemName={stockMovementItem.name}
            currentStock={0}
          />
        </Suspense>
      )}

      {deletingItem && (
        <Suspense fallback={null}>
          <DeleteItemConfirmationDialog
            open={!!deletingItem}
            onOpenChange={(open) => { if (!open) setDeletingItem(null); }}
            item={deletingItem}
            onConfirmDelete={(itemId, forceDelete) => deleteItem({ id: itemId, forceDelete })}
            onMarkInactive={markItemInactive}
            isLoading={isDeleting || isMarkingInactive}
          />
        </Suspense>
      )}

      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-lg">
            <img src={previewImage.url} alt={previewImage.name} className="w-full rounded" />
            <p className="text-center text-sm text-muted-foreground">{previewImage.name}</p>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
