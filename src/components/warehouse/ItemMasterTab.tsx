import { useState, useMemo, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, History, Settings, Eye, ArrowLeftRight, MapPin, BarChart3, Wrench, Image as ImageIcon, X, Package, FileWarning, ChevronDown, Download, FileSpreadsheet, PackagePlus, Loader2, Columns3, Upload, CheckSquare } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { useWarehouseItems } from '@/hooks/useWarehouseItems';
import { useWarehouseItemsLazyInventory } from '@/hooks/useWarehouseItemsLazyInventory';
import { useItemCategories } from '@/hooks/useItemCategories';
import { useItemUnits } from '@/hooks/useItemUnits';
import { useCompany } from '@/contexts/CompanyContext';
const AddItemsDialog = lazy(() =>
  import('@/components/warehouse/AddItemsDialog').then(m => ({ default: m.AddItemsDialog }))
);
const StockMovementDialog = lazy(() =>
  import('@/components/warehouse/StockMovementDialog').then(m => ({ default: m.StockMovementDialog }))
);
const StockAdjustmentDialog = lazy(() =>
  import('@/components/warehouse/StockAdjustmentDialog').then(m => ({ default: m.StockAdjustmentDialog }))
);
const DeleteItemConfirmationDialog = lazy(() =>
  import('@/components/warehouse/DeleteItemConfirmationDialog').then(m => ({ default: m.DeleteItemConfirmationDialog }))
);
const ItemDetailsDialog = lazy(() =>
  import('@/components/warehouse/ItemDetailsDialog').then(m => ({ default: m.ItemDetailsDialog }))
);
const ItemTransferDialog = lazy(() =>
  import('@/components/warehouse/ItemTransferDialog').then(m => ({ default: m.ItemTransferDialog }))
);
const ItemStockDetailsDialog = lazy(() =>
  import('@/components/warehouse/ItemStockDetailsDialog').then(m => ({ default: m.ItemStockDetailsDialog }))
);
const FixMissingOpeningStockDialog = lazy(() =>
  import('@/components/warehouse/FixMissingOpeningStockDialog').then(m => ({ default: m.FixMissingOpeningStockDialog }))
);
const StockMovementReportDialog = lazy(() =>
  import('@/components/warehouse/StockMovementReportDialog').then(m => ({ default: m.StockMovementReportDialog }))
);
const AddFromCatalogDialog = lazy(() =>
  import('@/components/warehouse/AddFromCatalogDialog').then(m => ({ default: m.AddFromCatalogDialog }))
);
const BulkStockUploadDialog = lazy(() =>
  import('@/components/warehouse/BulkStockUploadDialog').then(m => ({ default: m.BulkStockUploadDialog }))
);
const BulkInventoryUpdateDialog = lazy(() =>
  import('@/components/warehouse/BulkInventoryUpdateDialog').then(m => ({ default: m.BulkInventoryUpdateDialog }))
);
const BulkInventoryDeleteDialog = lazy(() =>
  import('@/components/warehouse/BulkInventoryDeleteDialog').then(m => ({ default: m.BulkInventoryDeleteDialog }))
);
const BulkChangeStockOwnerDialog = lazy(() =>
  import('@/components/warehouse/BulkChangeStockOwnerDialog').then(m => ({ default: m.BulkChangeStockOwnerDialog }))
);
import { WarehouseItem } from '@/types/itemBin';
import { supabase } from '@/integrations/supabase/client';

import { useLocationFilter } from '@/contexts/LocationFilterContext';
import { useWarehouseBinAllocations } from '@/hooks/useWarehouseBinAllocations';
import { useWarehouseLocations } from '@/hooks/useWarehouseLocations';
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';
import { writeExcelFromJSON } from '@/utils/excelUtils';
import { format } from 'date-fns';
import { toast } from 'sonner';

const INV_COLUMN_DEFS = [
  { key: 'photo', label: 'Photo', fixed: false },
  { key: 'item_code', label: 'Item Code', fixed: false },
  { key: 'name', label: 'Name', fixed: true },
  { key: 'category', label: 'Category', fixed: false },
  { key: 'unit', label: 'Unit', fixed: false },
  { key: 'bin', label: 'Bin', fixed: false },
  { key: 'stock_owner', label: 'Stock Owner', fixed: false },
  { key: 'current_stock', label: 'Current Stock', fixed: false },
  { key: 'unit_cost', label: 'Unit Cost', fixed: false },
  { key: 'status', label: 'Status', fixed: false },
  { key: 'actions', label: 'Actions', fixed: true },
] as const;

type InvColumnKey = typeof INV_COLUMN_DEFS[number]['key'];

const INV_DEFAULT_VISIBLE: Record<InvColumnKey, boolean> = Object.fromEntries(
  INV_COLUMN_DEFS.map(c => [c.key, true])
) as Record<InvColumnKey, boolean>;

interface LocationStock {
  locationId: string;
  locationName: string;
  stock: number;
}

interface ItemLocationStockMap {
  [itemId: string]: LocationStock[];
}

interface ItemMasterTabProps {
  onGoToAudit?: () => void;
}

export function ItemMasterTab({ onGoToAudit }: ItemMasterTabProps) {
  
  const queryClient = useQueryClient();
  const { globalLocationId } = useLocationFilter();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [viewingItem, setViewingItem] = useState<WarehouseItem | null>(null);
  const [stockMovementItem, setStockMovementItem] = useState<WarehouseItem | null>(null);
  const [stockAdjustmentItem, setStockAdjustmentItem] = useState<WarehouseItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<WarehouseItem | null>(null);
  const [transferItem, setTransferItem] = useState<WarehouseItem | null>(null);
  const [stockDetailsItem, setStockDetailsItem] = useState<WarehouseItem | null>(null);
  const [isFixOpeningStockDialogOpen, setIsFixOpeningStockDialogOpen] = useState(false);
  const [isStockMovementReportOpen, setIsStockMovementReportOpen] = useState(false);
  const [isImportCatalogOpen, setIsImportCatalogOpen] = useState(false);
  const [isBulkStockUploadOpen, setIsBulkStockUploadOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<InvColumnKey, boolean>>(INV_DEFAULT_VISIBLE);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [isBulkChangeOwnerOpen, setIsBulkChangeOwnerOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  
  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [binFilter, setBinFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [ownerLabelFilter, setOwnerLabelFilter] = useState<string>("");
  const [debouncedOwnerLabel, setDebouncedOwnerLabel] = useState<string>("");
  const [stockMode, setStockMode] = useState<'all' | 'in_stock' | 'zero' | 'low'>("all");
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  const toggleColumn = (key: InvColumnKey) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const col = (key: InvColumnKey) => visibleColumns[key];
  const visibleCount = Object.values(visibleColumns).filter(Boolean).length;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedOwnerLabel(ownerLabelFilter.trim()), 300);
    return () => clearTimeout(timer);
  }, [ownerLabelFilter]);

  // Lazy loading hook for inventory items
  const {
    data: lazyData,
    isLoading,
    isError,
    error: lazyError,
    refetch: refetchInventory,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useWarehouseItemsLazyInventory({
    pageSize: 50,
    search: debouncedSearch,
    categoryId: categoryFilter,
    status: statusFilter,
    locationId: globalLocationId,
    stockMode,
    ownerLabel: debouncedOwnerLabel || null,
  });

  // Keep mutations via the old hook with fetching disabled
  const { 
    deleteItem, 
    markItemInactive, 
    isDeleting, 
    isMarkingInactive 
  } = useWarehouseItems({ disableFetch: true });

  const { companies, selectedCompany } = useCompany();
  const { categories } = useItemCategories(selectedCompany?.id);
  const { units } = useItemUnits();
  const { migrateAllocationsToCorrectLocation, isMigrating, reconcileStock, isReconciling, fixAllocationsFromHistory, isFixingFromHistory } = useWarehouseBinAllocations({ disableFetch: true });
  const { canDelete } = useIsAdminOrHigher();

  // Flatten all pages into a single items array
  const allItems = useMemo(() => {
    if (!lazyData?.pages) return [];
    return lazyData.pages.flatMap((page) => page.items);
  }, [lazyData]);

  const totalLoaded = allItems.length;

  // Bin filter is client-side since bins come from enrichment
  const filteredItems = useMemo(() => {
    if (binFilter === 'all') return allItems;
    return allItems.filter(item => item.bins?.some(b => b.bin_code === binFilter));
  }, [allItems, binFilter]);

  // IntersectionObserver sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { locations: allLocations = [] } = useWarehouseLocations();
  const locationNameById = useMemo(
    () => new Map(allLocations.map((location) => [location.id, location.name])),
    [allLocations]
  );

  // O(1) lookup maps — replaces O(n*m) .find() calls in the render loop
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const unitById = useMemo(
    () => new Map(units.map((u) => [u.id, u])),
    [units]
  );
  const companyById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );

  // The inventory RPC already returns location-scoped stock for the selected
  // location/subtree. Keep the UI summary derived from those canonical rows.
  const itemLocationStock = useMemo<ItemLocationStockMap>(() => {
    if (!globalLocationId) return {};

    const locationName = locationNameById.get(globalLocationId) ?? 'Selected location';
    return allItems.reduce<ItemLocationStockMap>((acc, item) => {
      const stock = Number(item.current_stock || 0);
      if (stock > 0) {
        acc[item.id] = [{ locationId: globalLocationId, locationName, stock }];
      }
      return acc;
    }, {});
  }, [allItems, globalLocationId, locationNameById]);

  // Extract unique bins from loaded items for client-side bin filter
  const uniqueBins = useMemo(() => {
    const binMap = new Map<string, string>();
    allItems.forEach(item => {
      item.bins?.forEach(bin => {
        binMap.set(bin.bin_code, bin.name);
      });
    });
    return Array.from(binMap.entries()).map(([code, name]) => ({ code, name }));
  }, [allItems]);

  const hasActiveFilters = categoryFilter !== "all" || binFilter !== "all" || statusFilter !== "all" || stockMode !== "all" || ownerLabelFilter !== "";

  const clearFilters = () => {
    setCategoryFilter("all");
    setBinFilter("all");
    setStatusFilter("all");
    setStockMode("all");
    setOwnerLabelFilter("");
  };

  // Selection helpers
  const toggleSelectItem = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const clearSelection = () => setSelectedItemIds(new Set());

  const selectedItems = useMemo(() => {
    return filteredItems.filter(i => selectedItemIds.has(i.id));
  }, [filteredItems, selectedItemIds]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'discontinued': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleDownloadItemMaster = async () => {
    try {
      if (allItems.length === 0) {
        toast.error('No items to export');
        return;
      }

      const exportData = allItems.map(item => {
        const category = categories.find(c => c.id === item.category_id);
        const unit = units.find(u => u.id === item.unit_id);
        const company = companies.find(c => c.id === item.company_id);
        const binsString = item.bins?.map(b => `${b.bin_code} (${b.quantity})`).join(', ') || '';

        return {
          'Item Code': item.item_code,
          'Name': item.name,
          'Description': item.description || '',
          'Category': category?.name || '',
          'Unit': unit?.abbreviation || '',
          'Brand': item.brand || '',
          'Manufacturer': item.manufacturer || '',
          'Supplier': item.supplier?.name || '',
          'Bin(s)': binsString,
          'Current Stock': item.current_stock || 0,
          'Unit Cost': item.unit_cost || 0,
          'Selling Price': item.selling_price || 0,
          'Reorder Level': item.reorder_level || 0,
          'Min Stock Level': item.min_stock_level || 0,
          'Max Stock Level': item.max_stock_level || 0,
          'Status': item.status || '',
          'Barcode': item.barcode || '',
          'SKU': item.sku || '',
          'Company': company?.name || 'All Companies',
        };
      });

      const companyName = selectedCompany?.name 
        ? selectedCompany.name.toLowerCase().replace(/\s+/g, '-') 
        : 'all-companies';
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const fileName = `item-master-${companyName}-${dateStr}.xlsx`;

      await writeExcelFromJSON(exportData, fileName, 'Item Master');
      toast.success(`Exported ${allItems.length} items to Excel`);
    } catch (error) {
      console.error('Failed to export item master:', error);
      toast.error('Failed to export item master');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-48"
              />
            </div>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={binFilter} onValueChange={setBinFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Bin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bins</SelectItem>
                {uniqueBins.map(bin => (
                  <SelectItem key={bin.code} value={bin.code}>
                    {bin.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="discontinued">Discontinued</SelectItem>
              </SelectContent>
            </Select>

            <Select value={stockMode} onValueChange={(v) => setStockMode(v as typeof stockMode)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="in_stock">In Stock (&gt; 0)</SelectItem>
                <SelectItem value="zero">Zero Stock</SelectItem>
                <SelectItem value="low">Low Stock (≤ Reorder)</SelectItem>
              </SelectContent>
            </Select>


            <Input
              placeholder="Stock Owner"
              value={ownerLabelFilter}
              onChange={(e) => setOwnerLabelFilter(e.target.value)}
              className="w-[160px]"
            />

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}

            <span className="text-xs text-muted-foreground ml-2">
              Loaded {totalLoaded} items
              {isFetchingNextPage && ' • Loading more...'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Column visibility toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="mr-2 h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 p-2 space-y-1">
                {INV_COLUMN_DEFS.filter(c => !c.fixed).map(colDef => (
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
            {canDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Settings className="mr-2 h-4 w-4" />
                    Admin Tools
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      if (!globalLocationId) {
                        toast.warning('Please select a warehouse location first to reconcile items without locations.');
                        return;
                      }
                      reconcileStock(globalLocationId);
                    }}
                    disabled={isReconciling}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    {isReconciling ? 'Reconciling...' : 'Reconcile Stock'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => fixAllocationsFromHistory()}
                    disabled={isFixingFromHistory}
                  >
                    <History className="mr-2 h-4 w-4" />
                    {isFixingFromHistory ? 'Fixing...' : 'Fix from History'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => migrateAllocationsToCorrectLocation()}
                    disabled={isMigrating}
                  >
                    <Wrench className="mr-2 h-4 w-4" />
                    {isMigrating ? 'Fixing...' : 'Fix Allocations'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setIsFixOpeningStockDialogOpen(true)}
                  >
                    <FileWarning className="mr-2 h-4 w-4" />
                    Fix Opening Stock
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadItemMaster}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Item Master
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsStockMovementReportOpen(true)}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Stock Movement Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="outline" onClick={() => setIsBulkStockUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Upload Stock
            </Button>
            <Button onClick={() => setIsImportCatalogOpen(true)}>
              <PackagePlus className="mr-2 h-4 w-4" /> Import from Catalog
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table className="min-w-full [&_td]:py-1.5 [&_th]:py-2">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={filteredItems.length > 0 && selectedItemIds.size === filteredItems.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              {col('photo') && <TableHead className="w-[50px]">Photo</TableHead>}
              {col('item_code') && <TableHead>Item Code</TableHead>}
              <TableHead>Name</TableHead>
              {col('category') && <TableHead>Category</TableHead>}
              {col('unit') && <TableHead>Unit</TableHead>}
              {col('bin') && <TableHead>Bin</TableHead>}
              {col('stock_owner') && <TableHead>Stock Owner</TableHead>}
              {col('current_stock') && <TableHead className="text-right">Current Stock</TableHead>}
              {col('unit_cost') && <TableHead>Unit Cost</TableHead>}
              {col('status') && <TableHead>Status</TableHead>}
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
              <TableCell colSpan={visibleCount + 1} className="text-center py-8">
                  Loading items...
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCount + 1} className="text-center py-8 text-muted-foreground">
                  {globalLocationId && selectedCompany?.name
                    ? `No inventory for ${selectedCompany.name} at ${
                        locationNameById.get(globalLocationId) ?? 'this location'
                      }.`
                    : 'No items found. Create your first item to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.id} data-state={selectedItemIds.has(item.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedItemIds.has(item.id)}
                      onCheckedChange={() => toggleSelectItem(item.id)}
                    />
                  </TableCell>
                  {col('photo') && (
                    <TableCell>
                      <div 
                        className={`w-8 h-8 rounded border overflow-hidden bg-muted flex items-center justify-center ${item.image_url ? 'cursor-pointer hover:ring-2 hover:ring-primary transition-all' : ''}`}
                        onClick={() => {
                          if (item.image_url) {
                            setPreviewImage({ url: item.image_url, name: item.name });
                          }
                        }}
                      >
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              (e.currentTarget.parentElement?.querySelector('.placeholder-icon') as HTMLElement)?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <ImageIcon className={`h-4 w-4 text-muted-foreground placeholder-icon ${item.image_url ? 'hidden' : ''}`} />
                      </div>
                    </TableCell>
                  )}
                  {col('item_code') && <TableCell className="font-medium">{item.item_code}</TableCell>}
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
                  {col('category') && (
                    <TableCell>
                      {item.category_id
                        ? categoryById.get(item.category_id)?.name || '-'
                        : '-'
                      }
                    </TableCell>
                  )}
                  {col('unit') && (
                    <TableCell>
                      {item.unit_id
                        ? unitById.get(item.unit_id)?.abbreviation || '-'
                        : '-'
                      }
                    </TableCell>
                  )}
                  {col('bin') && (
                    <TableCell>
                      {item.bins && item.bins.length > 0 ? (
                        <TooltipProvider>
                          <div className="flex flex-wrap gap-1">
                            {item.bins.slice(0, 2).map(bin => (
                              <Tooltip key={bin.id}>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs cursor-help">
                                    <Package className="h-3 w-3 mr-1" />
                                    {bin.bin_code}
                                    <span className="ml-1 text-muted-foreground">({bin.quantity})</span>
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{bin.name} - Qty: {bin.quantity}</p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                            {item.bins.length > 2 && (
                              <span className="text-xs text-muted-foreground">
                                +{item.bins.length - 2} more
                              </span>
                            )}
                          </div>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  )}
                  {col('stock_owner') && (
                    <TableCell>
                      {item.stock_owners && item.stock_owners.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.stock_owners.map((n, i) => (
                            <Badge
                              key={`${n}-${i}`}
                              variant={n === 'Unassigned' ? 'outline' : 'secondary'}
                              className="text-xs"
                            >
                              {n}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                  {col('current_stock') && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="space-y-1 text-right min-w-[140px]">
                          {itemLocationStock[item.id]?.length > 0 ? (
                            <>
                              {itemLocationStock[item.id].slice(0, 3).map((loc) => (
                                <div key={loc.locationId} className="flex items-center justify-end gap-1.5 text-xs">
                                  <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
                                  <span className="text-muted-foreground truncate max-w-[80px]">{loc.locationName}:</span>
                                  <span className={`font-medium ${
                                    loc.stock <= (item.reorder_level || 0) ? 'text-destructive' : 'text-green-600'
                                  }`}>
                                    {loc.stock}
                                  </span>
                                </div>
                              ))}
                              {itemLocationStock[item.id].length > 3 && (
                                <div className="text-xs text-muted-foreground">
                                  +{itemLocationStock[item.id].length - 3} more locations
                                </div>
                              )}
                              {(() => {
                                const calculatedTotal = itemLocationStock[item.id]?.reduce((sum, loc) => sum + loc.stock, 0) || 0;
                                // When the user is viewing a specific location, the totals here
                                // are intentionally a subset (this location only) of the item
                                // master total — do NOT flag that as a desync.
                                const isOutOfSync = !globalLocationId && calculatedTotal !== (item.current_stock || 0);
                                return (
                                  <div className="text-xs border-t border-border pt-1 mt-1 text-muted-foreground flex items-center justify-end gap-2">
                                    {isOutOfSync && (
                                      <span className="text-yellow-600" title={`DB shows ${item.current_stock || 0}, allocations total ${calculatedTotal}. Run Reconcile Stock to fix.`}>
                                        ⚠️
                                      </span>
                                    )}
                                    <span>Total: <span className="font-semibold text-foreground">{calculatedTotal}</span></span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setStockDetailsItem(item)}
                                      className="p-0.5 h-5 w-5"
                                      title="View Stock Details"
                                    >
                                      <BarChart3 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                );
                              })()}
                            </>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              {(item.current_stock || 0) > 0 && (
                                <span className="text-yellow-600" title={`Stock exists (${item.current_stock}) but no bin allocations. Run Reconcile Stock to fix.`}>
                                  ⚠️
                                </span>
                              )}
                              <span className={`font-medium ${
                                (item.current_stock || 0) <= (item.reorder_level || 0) ? 'text-destructive' : 
                                (item.current_stock || 0) <= (item.min_stock_level || 0) ? 'text-yellow-600' : 
                                'text-green-600'
                              }`}>
                                {item.current_stock || 0}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setStockDetailsItem(item)}
                                className="p-0.5 h-5 w-5"
                                title="View Stock Details"
                              >
                                <BarChart3 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setStockAdjustmentItem(item)}
                            className="p-1 h-6 w-6"
                            title="Adjust Stock"
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setStockMovementItem(item)}
                            className="p-1 h-6 w-6"
                            title="View History"
                          >
                            <History className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  )}
                  {col('unit_cost') && <TableCell>{item.unit_cost ? `LKR ${item.unit_cost}` : '-'}</TableCell>}
                  {col('status') && (
                    <TableCell>
                      <Badge className={getStatusColor(item.status)}>
                        {item.status}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingItem(item)}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTransferItem(item)}
                        title="Transfer Between Warehouses"
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingItem(item)}
                          disabled={isDeleting || isMarkingInactive}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />

        {isFetchingNextPage && (
          <div className="flex items-center justify-center py-4 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more items...
          </div>
        )}

        {!hasNextPage && totalLoaded > 0 && !isLoading && (
          <div className="text-center py-3 text-xs text-muted-foreground">
            All {totalLoaded} items loaded
          </div>
        )}
      </div>

      {(isCreateDialogOpen || editingItem !== null) && (
        <Suspense fallback={null}>
          <AddItemsDialog
            open={isCreateDialogOpen || editingItem !== null}
            onOpenChange={(open) => {
              setIsCreateDialogOpen(open);
              if (!open) setEditingItem(null);
            }}
            editingItem={editingItem}
          />
        </Suspense>
      )}

      {stockMovementItem && (() => {
        // Prefer the globally-selected location so history is scoped to bins at that physical site.
        const scopeLocationId = globalLocationId ?? stockMovementItem.location_id ?? null;
        const scopeLocationName =
          scopeLocationId ? locationNameById.get(scopeLocationId) ?? null : null;
        return (
          <Suspense fallback={null}>
            <StockMovementDialog
              open={!!stockMovementItem}
              onOpenChange={(open) => {
                if (!open) setStockMovementItem(null);
              }}
              itemId={stockMovementItem.id}
              itemName={stockMovementItem.name}
              currentStock={stockMovementItem.current_stock || 0}
              locationId={scopeLocationId}
              locationName={scopeLocationName}
            />
          </Suspense>
        );
      })()}

      {stockAdjustmentItem && (
        <Suspense fallback={null}>
          <StockAdjustmentDialog
            open={!!stockAdjustmentItem}
            onOpenChange={(open) => {
              if (!open) setStockAdjustmentItem(null);
            }}
            itemId={stockAdjustmentItem.id}
            itemName={stockAdjustmentItem.name}
            currentStock={stockAdjustmentItem.current_stock || 0}
          />
        </Suspense>
      )}

      {deletingItem && (
        <Suspense fallback={null}>
          <DeleteItemConfirmationDialog
            open={!!deletingItem}
            onOpenChange={(open) => {
              if (!open) setDeletingItem(null);
            }}
            item={deletingItem}
            onConfirmDelete={async (itemId) => {
              try {
                const { error } = await supabase.rpc('remove_item_from_inventory' as any, { p_item_id: itemId });
                if (error) throw error;
                toast.success('Item removed from inventory (catalog entry preserved)');
                setDeletingItem(null);
                queryClient.invalidateQueries({ queryKey: ['warehouse-items-inventory'] });
                queryClient.invalidateQueries({ queryKey: ['warehouse-items-catalog-ids', selectedCompany?.id] });
                queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
                queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
              } catch (error: any) {
                console.error('Error removing from inventory:', error);
                toast.error(error?.message || 'Failed to remove item from inventory');
              }
            }}
            onMarkInactive={markItemInactive}
            isLoading={isDeleting || isMarkingInactive}
          />
        </Suspense>
      )}

      {viewingItem && (
        <Suspense fallback={null}>
          <ItemDetailsDialog
            item={viewingItem}
            open={!!viewingItem}
            onOpenChange={(open) => {
              if (!open) setViewingItem(null);
            }}
          />
        </Suspense>
      )}

      {transferItem && (
        <Suspense fallback={null}>
          <ItemTransferDialog
            open={!!transferItem}
            onOpenChange={(open) => {
              if (!open) setTransferItem(null);
            }}
            item={transferItem}
          />
        </Suspense>
      )}

      {stockDetailsItem && (
        <Suspense fallback={null}>
          <ItemStockDetailsDialog
            open={!!stockDetailsItem}
            onOpenChange={(open) => {
              if (!open) setStockDetailsItem(null);
            }}
            item={stockDetailsItem}
            locationStock={stockDetailsItem ? (itemLocationStock[stockDetailsItem.id] || []) : []}
            allLocations={allLocations}
          />
        </Suspense>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl p-2">
          {previewImage && (
            <div className="flex flex-col items-center pt-6">
              <img 
                src={previewImage.url} 
                alt={previewImage.name}
                className="max-h-[70vh] w-auto object-contain rounded"
              />
              <p className="mt-2 text-sm text-muted-foreground">{previewImage.name}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {isFixOpeningStockDialogOpen && (
        <Suspense fallback={null}>
          <FixMissingOpeningStockDialog
            open={isFixOpeningStockDialogOpen}
            onOpenChange={setIsFixOpeningStockDialogOpen}
          />
        </Suspense>
      )}

      {isStockMovementReportOpen && (
        <Suspense fallback={null}>
          <StockMovementReportDialog
            open={isStockMovementReportOpen}
            onOpenChange={setIsStockMovementReportOpen}
          />
        </Suspense>
      )}

      {isImportCatalogOpen && (
        <Suspense fallback={null}>
          <AddFromCatalogDialog
            open={isImportCatalogOpen}
            onOpenChange={setIsImportCatalogOpen}
          />
        </Suspense>
      )}

      {isBulkStockUploadOpen && (
        <Suspense fallback={null}>
          <BulkStockUploadDialog
            open={isBulkStockUploadOpen}
            onOpenChange={setIsBulkStockUploadOpen}
          />
        </Suspense>
      )}

      {/* Floating selection action bar */}
      {selectedItemIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{selectedItemIds.size} item(s) selected</span>
          <Button size="sm" variant="outline" onClick={() => setIsBulkUpdateOpen(true)}>Bulk Update</Button>
          <Button size="sm" variant="outline" onClick={() => setIsBulkChangeOwnerOpen(true)}>Change Stock Owner</Button>
          {canDelete && (
            <Button size="sm" variant="destructive" onClick={() => setIsBulkDeleteOpen(true)}>Bulk Delete</Button>
          )}
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {isBulkUpdateOpen && (
        <Suspense fallback={null}>
          <BulkInventoryUpdateDialog
            open={isBulkUpdateOpen}
            onOpenChange={setIsBulkUpdateOpen}
            selectedIds={selectedItemIds}
            onComplete={clearSelection}
            defaultOwnerLabel={debouncedOwnerLabel || null}
          />
        </Suspense>
      )}

      {isBulkDeleteOpen && (
        <Suspense fallback={null}>
          <BulkInventoryDeleteDialog
            open={isBulkDeleteOpen}
            onOpenChange={setIsBulkDeleteOpen}
            selectedItems={selectedItems}
            onComplete={clearSelection}
          />
        </Suspense>
      )}
      {isBulkChangeOwnerOpen && (
        <Suspense fallback={null}>
          <BulkChangeStockOwnerDialog
            open={isBulkChangeOwnerOpen}
            onOpenChange={setIsBulkChangeOwnerOpen}
            selectedIds={selectedItemIds}
            onComplete={clearSelection}
            defaultFromOwner={debouncedOwnerLabel || null}
          />
        </Suspense>
      )}
    </div>
  );
}
