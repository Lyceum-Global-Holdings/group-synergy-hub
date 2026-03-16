import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, History, Settings, Eye, ArrowLeftRight, MapPin, BarChart3, Wrench, Image as ImageIcon, X, Package, FileWarning, ChevronDown, Download, FileSpreadsheet, PackagePlus, Loader2, Columns3 } from 'lucide-react';
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
import { AddItemsDialog } from '@/components/warehouse/AddItemsDialog';
import { StockMovementDialog } from '@/components/warehouse/StockMovementDialog';
import { StockAdjustmentDialog } from '@/components/warehouse/StockAdjustmentDialog';
import { DeleteItemConfirmationDialog } from '@/components/warehouse/DeleteItemConfirmationDialog';
import { ItemDetailsDialog } from '@/components/warehouse/ItemDetailsDialog';
import { ItemTransferDialog } from '@/components/warehouse/ItemTransferDialog';
import { ItemStockDetailsDialog } from '@/components/warehouse/ItemStockDetailsDialog';
import { FixMissingOpeningStockDialog } from '@/components/warehouse/FixMissingOpeningStockDialog';
import { StockMovementReportDialog } from '@/components/warehouse/StockMovementReportDialog';
import { AddFromCatalogDialog } from '@/components/warehouse/AddFromCatalogDialog';
import { WarehouseItem } from '@/types/itemBin';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeStockUpdates } from '@/hooks/useRealtimeStockUpdates';
import { useWarehouseBinAllocations } from '@/hooks/useWarehouseBinAllocations';
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';
import { useStockAudit } from '@/hooks/useStockAudit';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { writeExcelFromJSON } from '@/utils/excelUtils';
import { format } from 'date-fns';
import { toast } from 'sonner';

const INV_COLUMN_DEFS = [
  { key: 'photo', label: 'Photo', fixed: false },
  { key: 'item_code', label: 'Item Code', fixed: false },
  { key: 'name', label: 'Name', fixed: true },
  { key: 'category', label: 'Category', fixed: false },
  { key: 'unit', label: 'Unit', fixed: false },
  { key: 'brand', label: 'Brand', fixed: false },
  { key: 'supplier', label: 'Supplier', fixed: false },
  { key: 'bin', label: 'Bin', fixed: false },
  { key: 'company', label: 'Company', fixed: false },
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
  useRealtimeStockUpdates();
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
  const [visibleColumns, setVisibleColumns] = useState<Record<InvColumnKey, boolean>>(INV_DEFAULT_VISIBLE);
  
  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [binFilter, setBinFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
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

  // Lazy loading hook for inventory items
  const {
    data: lazyData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useWarehouseItemsLazyInventory({
    pageSize: 100,
    search: debouncedSearch,
    categoryId: categoryFilter,
    status: statusFilter,
    supplierId: supplierFilter,
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
  const { migrateAllocationsToCorrectLocation, isMigrating, reconcileStock, isReconciling, fixAllocationsFromHistory, isFixingFromHistory } = useWarehouseBinAllocations();
  const { canDelete } = useIsAdminOrHigher();
  const { summary } = useStockAudit();

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

  // Fetch all top-level warehouse locations
  const { data: allLocations = [] } = useQuery({
    queryKey: ['all-warehouse-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_locations')
        .select('id, name')
        .is('parent_id', null)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch stock by location for all items
  const { data: itemLocationStock = {} } = useQuery<ItemLocationStockMap>({
    queryKey: ['all-items-location-stock'],
    queryFn: async () => {
      const { data: allocations, error: allocError } = await supabase
        .from('warehouse_bin_allocations')
        .select('warehouse_item_id, bin_id, available_quantity')
        .gt('available_quantity', 0);
      
      if (allocError) throw allocError;
      if (!allocations || allocations.length === 0) return {};
      
      const binIds = [...new Set(allocations.map(a => a.bin_id).filter(Boolean))];
      if (binIds.length === 0) return {};
      
      const { data: bins, error: binsError } = await supabase
        .from('warehouse_bins')
        .select('id, location_id')
        .in('id', binIds);
      
      if (binsError) throw binsError;
      if (!bins || bins.length === 0) return {};
      
      const locationIds = [...new Set(bins.map(b => b.location_id).filter(Boolean))] as string[];
      if (locationIds.length === 0) return {};
      
      const { data: locations, error: locError } = await supabase
        .from('warehouse_locations')
        .select('id, name')
        .in('id', locationIds);
      
      if (locError) throw locError;
      
      const binLocationMap = new Map(bins.map(b => [b.id, b.location_id]));
      const locationNameMap = new Map(locations?.map(l => [l.id, l.name]) || []);
      
      const grouped: ItemLocationStockMap = {};
      
      allocations.forEach((alloc) => {
        const itemId = alloc.warehouse_item_id;
        const binId = alloc.bin_id;
        if (!binId) return;
        
        const locationId = binLocationMap.get(binId);
        if (!locationId) return;
        
        const locationName = locationNameMap.get(locationId);
        if (!locationName) return;
        
        if (!grouped[itemId]) grouped[itemId] = [];
        
        const existing = grouped[itemId].find(l => l.locationId === locationId);
        if (existing) {
          existing.stock += Number(alloc.available_quantity);
        } else {
          grouped[itemId].push({ 
            locationId, 
            locationName, 
            stock: Number(alloc.available_quantity) 
          });
        }
      });
      
      return grouped;
    },
  });

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

  // Extract unique suppliers from loaded items for the supplier filter dropdown
  const uniqueSuppliers = useMemo(() => {
    const suppliers = new Set<string>();
    allItems.forEach(item => {
      if (item.supplier?.name) suppliers.add(item.supplier.name);
    });
    return Array.from(suppliers).sort();
  }, [allItems]);

  const hasActiveFilters = categoryFilter !== "all" || binFilter !== "all" || statusFilter !== "all" || supplierFilter !== "all";

  const clearFilters = () => {
    setCategoryFilter("all");
    setBinFilter("all");
    setStatusFilter("all");
    setSupplierFilter("all");
  };

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
      {summary.desynced > 0 && (
        <Alert className="border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong>{summary.desynced} item{summary.desynced > 1 ? 's have' : ' has'} a stock desync</strong>
              {' '}— item master stock does not match bin allocation totals.
            </span>
            {onGoToAudit && (
              <Button
                variant="outline"
                size="sm"
                className="ml-4 shrink-0 border-yellow-400 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-600 dark:text-yellow-300 dark:hover:bg-yellow-900/50"
                onClick={onGoToAudit}
              >
                <ShieldAlert className="mr-1 h-3 w-3" />
                Go to Stock Audit
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
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

            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {uniqueSuppliers.map(supplier => (
                  <SelectItem key={supplier} value={supplier}>
                    {supplier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
                    onClick={() => reconcileStock()}
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
            <Button onClick={() => setIsImportCatalogOpen(true)}>
              <PackagePlus className="mr-2 h-4 w-4" /> Import from Catalog
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table className="[&_td]:py-1.5 [&_th]:py-2">
          <TableHeader>
            <TableRow>
              {col('photo') && <TableHead className="w-[50px]">Photo</TableHead>}
              {col('item_code') && <TableHead>Item Code</TableHead>}
              <TableHead>Name</TableHead>
              {col('category') && <TableHead>Category</TableHead>}
              {col('unit') && <TableHead>Unit</TableHead>}
              {col('brand') && <TableHead>Brand</TableHead>}
              {col('supplier') && <TableHead>Supplier</TableHead>}
              {col('bin') && <TableHead>Bin</TableHead>}
              {col('company') && <TableHead>Company</TableHead>}
              {col('current_stock') && <TableHead className="text-right">Current Stock</TableHead>}
              {col('unit_cost') && <TableHead>Unit Cost</TableHead>}
              {col('status') && <TableHead>Status</TableHead>}
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
              <TableCell colSpan={visibleCount} className="text-center py-8">
                  Loading items...
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleCount} className="text-center py-8 text-muted-foreground">
                  No items found. Create your first item to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.id}>
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
                        ? categories.find(c => c.id === item.category_id)?.name || '-'
                        : '-'
                      }
                    </TableCell>
                  )}
                  {col('unit') && (
                    <TableCell>
                      {item.unit_id 
                        ? units.find(u => u.id === item.unit_id)?.abbreviation || '-'
                        : '-'
                      }
                    </TableCell>
                  )}
                  {col('brand') && <TableCell>{item.brand || '-'}</TableCell>}
                  {col('supplier') && <TableCell>{item.supplier?.name || '-'}</TableCell>}
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
                  {col('company') && (
                    <TableCell>
                      {item.company_id 
                        ? companies.find(c => c.id === item.company_id)?.name || '-'
                        : 'All Companies'
                      }
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
                                const isOutOfSync = calculatedTotal !== (item.current_stock || 0);
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

      <AddItemsDialog
        open={isCreateDialogOpen || editingItem !== null}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) setEditingItem(null);
        }}
        editingItem={editingItem}
      />

      {stockMovementItem && (
        <StockMovementDialog
          open={!!stockMovementItem}
          onOpenChange={(open) => {
            if (!open) setStockMovementItem(null);
          }}
          itemId={stockMovementItem.id}
          itemName={stockMovementItem.name}
          currentStock={stockMovementItem.current_stock || 0}
        />
      )}

      {stockAdjustmentItem && (
        <StockAdjustmentDialog
          open={!!stockAdjustmentItem}
          onOpenChange={(open) => {
            if (!open) setStockAdjustmentItem(null);
          }}
          itemId={stockAdjustmentItem.id}
          itemName={stockAdjustmentItem.name}
          currentStock={stockAdjustmentItem.current_stock || 0}
        />
      )}

      <DeleteItemConfirmationDialog
        open={!!deletingItem}
        onOpenChange={(open) => {
          if (!open) setDeletingItem(null);
        }}
        item={deletingItem}
        onConfirmDelete={(itemId, forceDelete) => deleteItem({ id: itemId, forceDelete })}
        onMarkInactive={markItemInactive}
        isLoading={isDeleting || isMarkingInactive}
      />

      <ItemDetailsDialog
        item={viewingItem}
        open={!!viewingItem}
        onOpenChange={(open) => {
          if (!open) setViewingItem(null);
        }}
      />

      <ItemTransferDialog
        open={!!transferItem}
        onOpenChange={(open) => {
          if (!open) setTransferItem(null);
        }}
        item={transferItem}
      />

      <ItemStockDetailsDialog
        open={!!stockDetailsItem}
        onOpenChange={(open) => {
          if (!open) setStockDetailsItem(null);
        }}
        item={stockDetailsItem}
        locationStock={stockDetailsItem ? (itemLocationStock[stockDetailsItem.id] || []) : []}
        allLocations={allLocations}
      />

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

      <FixMissingOpeningStockDialog
        open={isFixOpeningStockDialogOpen}
        onOpenChange={setIsFixOpeningStockDialogOpen}
      />

      <StockMovementReportDialog
        open={isStockMovementReportOpen}
        onOpenChange={setIsStockMovementReportOpen}
      />

      <AddFromCatalogDialog
        open={isImportCatalogOpen}
        onOpenChange={setIsImportCatalogOpen}
      />
    </div>
  );
}
