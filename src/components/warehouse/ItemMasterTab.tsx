import { useState, useMemo, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Trash2, History, Settings, Eye, ArrowLeftRight, MapPin, BarChart3, Wrench, Image as ImageIcon, X, Package, FileWarning, ChevronDown, Download, FileSpreadsheet, Loader2, Columns3, Upload, ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal, SlidersHorizontal, Boxes, Coins, AlertTriangle, Activity, UserRound, PackageCheck, PencilLine, UserCog } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
const BulkIssueFromInventoryDialog = lazy(() =>
  import('@/components/warehouse/BulkIssueFromInventoryDialog').then(m => ({ default: m.BulkIssueFromInventoryDialog }))
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
import { useManagedColumns } from '@/hooks/useManagedColumns';
import { useWarehousePulse } from '@/hooks/useDashboardPulse';
import { cn } from '@/lib/utils';

const INV_COLUMN_DEFS = [
  { key: 'photo', label: 'Photo', fixed: false },
  { key: 'item_code', label: 'Item Code', fixed: false },
  { key: 'name', label: 'Name', fixed: true },
  { key: 'category', label: 'Category', fixed: false },
  { key: 'unit', label: 'Unit', fixed: false },
  { key: 'bin', label: 'Bin', fixed: false },
  { key: 'stock_owner', label: 'Stock Owner', fixed: false },
  { key: 'current_stock', label: 'Current Stock', fixed: false },
  { key: 'reserved', label: 'Reserved', fixed: false },
  { key: 'available', label: 'Available', fixed: false },
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
  
  const [isBulkStockUploadOpen, setIsBulkStockUploadOpen] = useState(false);
  const {
    visibleColumns,
    toggleColumn,
    col,
    resetToSystemDefault,
    applySystemWide,
    isApplying: isApplyingColumns,
    isSuperAdmin: canManageColumnsSystemWide,
    hasSystemDefault: hasSystemColumnDefault,
  } = useManagedColumns<InvColumnKey>({
    viewKey: 'warehouse_inventory_columns',
    defs: INV_COLUMN_DEFS,
    defaultVisible: INV_DEFAULT_VISIBLE,
  });
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [isBulkChangeOwnerOpen, setIsBulkChangeOwnerOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkIssueOpen, setIsBulkIssueOpen] = useState(false);
  
  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [binFilter, setBinFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [ownerLabelFilter, setOwnerLabelFilter] = useState<string>("");
  const [debouncedOwnerLabel, setDebouncedOwnerLabel] = useState<string>("");
  const [stockMode, setStockMode] = useState<'all' | 'in_stock' | 'zero' | 'low'>("all");
  const [sortBy, setSortBy] = useState<'name' | 'item_code' | 'created_at' | 'current_stock'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  const handleSort = (key: 'name' | 'item_code' | 'created_at' | 'current_stock') => {
    if (sortBy === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
    if (scrollParentRef.current) scrollParentRef.current.scrollTop = 0;
  };

  const SortIcon = ({ k }: { k: 'name' | 'item_code' | 'created_at' | 'current_stock' }) => {
    if (sortBy !== k) return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 opacity-50" />;
    return sortDir === 'asc'
      ? <ArrowUp className="ml-1 inline h-3.5 w-3.5" />
      : <ArrowDown className="ml-1 inline h-3.5 w-3.5" />;
  };

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
    sortBy,
    sortDir,
  });

  // Keep mutations via the old hook with fetching disabled
  const { 
    deleteItem, 
    markItemInactive, 
    isDeleting, 
    isMarkingInactive 
  } = useWarehouseItems({ disableFetch: true });

  const { companies, selectedCompany, formatCurrency, baseCurrency } = useCompany();
  // Company/location-wide totals for the summary tiles (not just the loaded page).
  const { data: pulse, isLoading: pulseLoading } = useWarehousePulse(selectedCompany?.id ?? null, globalLocationId);
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

  // Virtualized scroll container — only the visible ~50 rows are mounted
  // even when thousands of items have been loaded across infinite pages.
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const VIRTUALIZE_FROM = 100;
  const shouldVirtualize = filteredItems.length > VIRTUALIZE_FROM;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? filteredItems.length : 0,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 60,
    overscan: 8,
  });

  // Prefetch the next server page when the user scrolls near the end of the
  // currently materialized rows (TanStack Virtual + useInfiniteQuery pattern).
  const virtualItems = rowVirtualizer.getVirtualItems();
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    if (shouldVirtualize) {
      const last = virtualItems[virtualItems.length - 1];
      if (last && last.index >= filteredItems.length - 10) {
        fetchNextPage();
      }
    }
  }, [virtualItems, filteredItems.length, hasNextPage, isFetchingNextPage, fetchNextPage, shouldVirtualize]);

  // Fallback sentinel for the non-virtualized (small dataset) path.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (shouldVirtualize) return;
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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, shouldVirtualize]);


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

  // ---- presentation helpers ----
  const fmtQty = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const compactNumber = (n: number) =>
    new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  const STATUS_STYLE: Record<string, { dot: string; pill: string }> = {
    active: { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15' },
    inactive: { dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-600 ring-slate-500/15' },
    discontinued: { dot: 'bg-red-500', pill: 'bg-red-50 text-red-700 ring-red-600/15' },
  };
  const STOCK_MODES: { value: typeof stockMode; label: string }[] = [
    { value: 'all', label: 'All stock' },
    { value: 'in_stock', label: 'In stock' },
    { value: 'zero', label: 'Zero' },
    { value: 'low', label: 'Low' },
  ];
  const pillTrigger = (active: boolean) =>
    cn(
      'h-9 w-auto min-w-[140px] gap-2 rounded-full border-border/70 bg-background px-3.5 text-sm shadow-none',
      active && 'border-primary/40 bg-primary/5 font-medium text-primary',
    );
  const iconBtn =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const thClass = 'h-11 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
  const optionalCols = (['category', 'unit', 'bin', 'stock_owner', 'current_stock', 'reserved', 'available', 'unit_cost', 'status'] as const).filter(
    (k) => col(k),
  ).length;
  const colSpan = 3 + optionalCols; // select + item + actions

  const kpis = [
    { key: 'skus', label: 'Active SKUs', hint: 'Items with a stock record', icon: Boxes, value: pulse?.sku_count, display: (v: number) => v.toLocaleString('en-US') },
    { key: 'value', label: 'Stock value', hint: 'On hand × unit cost', icon: Coins, value: pulse?.on_hand_value, display: compactNumber, prefix: baseCurrency || undefined, title: (v: number) => formatCurrency(v) },
    { key: 'low', label: 'Low stock', hint: stockMode === 'low' ? 'Filtering the list — click to clear' : 'At or below reorder level — click to filter', icon: AlertTriangle, value: pulse?.low_stock_count, display: (v: number) => v.toLocaleString('en-US'), alert: (pulse?.low_stock_count ?? 0) > 0, onClick: () => setStockMode(stockMode === 'low' ? 'all' : 'low'), active: stockMode === 'low' },
    { key: 'moves', label: 'Moves · 24h', hint: 'Stock transactions in the last day', icon: Activity, value: pulse?.moves_24h, display: (v: number) => v.toLocaleString('en-US') },
  ];

  return (
    <div className="space-y-4">
      {/* Summary tiles — company / location-wide, from the dashboard pulse */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const Tag = k.onClick ? 'button' : 'div';
          return (
            <Tag
              key={k.key}
              {...(k.onClick ? { type: 'button' as const, onClick: k.onClick, 'aria-pressed': !!k.active } : {})}
              title={k.hint}
              className={cn(
                'flex min-w-0 items-center gap-2.5 rounded-2xl border border-border/60 bg-card p-3 text-left shadow-[var(--shadow-xs)] transition-all sm:gap-3 sm:p-4',
                k.onClick && 'hover:border-primary/40 hover:shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                k.active && 'border-primary/50 ring-2 ring-primary/15',
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10',
                  k.alert ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
                )}
              >
                <k.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs text-muted-foreground">{k.label}</span>
                {pulseLoading ? (
                  <span className="mt-1 block h-6 w-16 animate-pulse rounded-md bg-muted" />
                ) : (
                  <span
                    className={cn('block truncate text-lg font-semibold tabular-nums tracking-tight sm:text-xl', k.alert && 'text-destructive')}
                    title={k.value != null && k.title ? k.title(Number(k.value)) : undefined}
                  >
                    {k.value != null && 'prefix' in k && k.prefix && (
                      <span className="mr-1 text-xs font-medium text-muted-foreground">{k.prefix}</span>
                    )}
                    {k.value != null ? k.display(Number(k.value)) : '—'}
                  </span>
                )}
              </span>
            </Tag>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-3 shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, code or SKU…"
              aria-label="Search items"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 rounded-full border-transparent bg-muted/60 pl-10 pr-9 focus-visible:bg-background"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div role="radiogroup" aria-label="Stock level" className="inline-flex rounded-full bg-muted p-1">
            {STOCK_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={stockMode === m.value}
                onClick={() => setStockMode(m.value)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-all',
                  stockMode === m.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Column management — super admins only */}
            {canManageColumnsSystemWide && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 rounded-full border-border/70 px-3.5">
                    <Columns3 className="mr-2 h-4 w-4" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 space-y-1 rounded-xl p-2">
                  {INV_COLUMN_DEFS.filter(c => !c.fixed).map(colDef => (
                    <label key={colDef.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                      <Checkbox
                        checked={visibleColumns[colDef.key]}
                        onCheckedChange={() => toggleColumn(colDef.key)}
                      />
                      {colDef.label}
                    </label>
                  ))}
                  <DropdownMenuSeparator />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={(e) => { e.preventDefault(); resetToSystemDefault(); }}
                  >
                    Reset to system default
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs"
                    disabled={isApplyingColumns}
                    onClick={async (e) => {
                      e.preventDefault();
                      try {
                        await applySystemWide();
                        toast.success('Column layout applied system-wide for all users.');
                      } catch (err: any) {
                        toast.error(err?.message ?? 'Failed to apply system-wide.');
                      }
                    }}
                  >
                    <Settings className="mr-2 h-3.5 w-3.5" />
                    {isApplyingColumns ? 'Applying…' : 'Apply to everyone (system-wide)'}
                  </Button>
                  {hasSystemColumnDefault && (
                    <p className="px-2 pt-1 text-[10px] text-muted-foreground">
                      A system-wide default is set by an admin.
                    </p>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {canDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 rounded-full border-border/70 px-3.5">
                    <Wrench className="mr-2 h-4 w-4" />
                    Admin tools
                    <ChevronDown className="ml-1.5 h-4 w-4 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl">
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
                  <DropdownMenuItem onClick={() => setIsFixOpeningStockDialogOpen(true)}>
                    <FileWarning className="mr-2 h-4 w-4" />
                    Fix Opening Stock
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
            <Button variant="outline" size="sm" className="h-9 rounded-full border-border/70 px-3.5" onClick={() => setIsBulkStockUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Upload stock
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className={pillTrigger(categoryFilter !== 'all')} aria-label="Category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={binFilter} onValueChange={setBinFilter}>
            <SelectTrigger className={pillTrigger(binFilter !== 'all')} aria-label="Bin">
              <SelectValue placeholder="Bin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All bins</SelectItem>
              {uniqueBins.map(bin => (
                <SelectItem key={bin.code} value={bin.code}>
                  {bin.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className={pillTrigger(statusFilter !== 'all')} aria-label="Status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="discontinued">Discontinued</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Stock owner"
              aria-label="Stock owner"
              value={ownerLabelFilter}
              onChange={(e) => setOwnerLabelFilter(e.target.value)}
              className={cn(
                'h-9 w-[170px] rounded-full border-border/70 pl-9 text-sm',
                ownerLabelFilter && 'border-primary/40 bg-primary/5 text-primary',
              )}
            />
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9 rounded-full px-3 text-muted-foreground" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              Clear filters
            </Button>
          )}

          <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
            {totalLoaded.toLocaleString('en-US')} item{totalLoaded === 1 ? '' : 's'} loaded
            {hasNextPage && !isFetchingNextPage ? ' · scroll for more' : ''}
            {isFetchingNextPage && ' · loading more…'}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-xs)]">
        <div
          ref={scrollParentRef}
          className="overflow-auto"
          style={{ maxHeight: 'max(420px, calc(100svh - 380px))' }}
          role="grid"
          aria-rowcount={filteredItems.length}
          aria-label="Item master inventory"
        >
        <Table className="min-w-full">
          <TableHeader className="sticky top-0 z-10 bg-[hsl(var(--surface-2))] shadow-[inset_0_-1px_0_hsl(var(--border))]">
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className="w-12 pl-4">
                <Checkbox
                  aria-label="Select all loaded items"
                  checked={filteredItems.length > 0 && selectedItemIds.size === filteredItems.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className={thClass}>
                <span className="inline-flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="inline-flex items-center uppercase hover:text-foreground"
                    aria-sort={sortBy === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Item<SortIcon k="name" />
                  </button>
                  {col('item_code') && (
                    <button
                      type="button"
                      onClick={() => handleSort('item_code')}
                      className="inline-flex items-center uppercase hover:text-foreground"
                      aria-sort={sortBy === 'item_code' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      Code<SortIcon k="item_code" />
                    </button>
                  )}
                </span>
              </TableHead>
              {col('category') && <TableHead className={thClass}>Category</TableHead>}
              {col('unit') && <TableHead className={thClass}>Unit</TableHead>}
              {col('bin') && <TableHead className={thClass}>Bins</TableHead>}
              {col('stock_owner') && <TableHead className={thClass}>Stock owner</TableHead>}
              {col('current_stock') && (
                <TableHead className={cn(thClass, 'text-right')}>
                  <button
                    type="button"
                    onClick={() => handleSort('current_stock')}
                    className="inline-flex items-center uppercase hover:text-foreground"
                    aria-sort={sortBy === 'current_stock' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    On hand<SortIcon k="current_stock" />
                  </button>
                </TableHead>
              )}
              {col('reserved') && <TableHead className={cn(thClass, 'text-right')}>Reserved</TableHead>}
              {col('available') && <TableHead className={cn(thClass, 'text-right')}>Available</TableHead>}
              {col('unit_cost') && <TableHead className={cn(thClass, 'text-right')}>Unit cost</TableHead>}
              {col('status') && <TableHead className={thClass}>Status</TableHead>}
              {/* Actions stay pinned to the right edge while the table scrolls sideways */}
              <TableHead className={cn(thClass, 'sticky right-0 z-20 w-28 bg-[hsl(var(--surface-2))] pr-4 text-right shadow-[inset_1px_0_0_hsl(var(--border))]')}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`sk-${i}`} className="h-[60px] border-border/50 hover:bg-transparent">
                  <TableCell className="pl-4"><div className="h-4 w-4 animate-pulse rounded bg-muted" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
                      <div className="space-y-1.5">
                        <div className="h-3.5 w-48 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell colSpan={colSpan - 2}><div className="h-3.5 w-full max-w-md animate-pulse rounded bg-muted" /></TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colSpan} className="py-12 text-center text-destructive">
                  Inventory could not load{lazyError instanceof Error && lazyError.message ? `: ${lazyError.message}` : '.'}{' '}
                  <Button variant="link" size="sm" className="px-1" onClick={() => refetchInventory()}>
                    Retry
                  </Button>
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colSpan} className="py-14">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      <Package className="h-6 w-6" />
                    </span>
                    <div className="text-sm text-muted-foreground">
                      {hasActiveFilters || debouncedSearch
                        ? 'No items match your search and filters.'
                        : globalLocationId && selectedCompany?.name
                          ? `No inventory for ${selectedCompany.name} at ${locationNameById.get(globalLocationId) ?? 'this location'}.`
                          : 'No items found. Add items from the catalog to get started.'}
                    </div>
                    {(hasActiveFilters || searchTerm) && (
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => { clearFilters(); setSearchTerm(''); }}>
                        Clear search and filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : ((() => {
              const renderRow = (item: typeof filteredItems[number], idx: number) => {
                const reserved = Number(item.reserved_quantity ?? 0);
                const available = Number(item.available_quantity ?? ((item.current_stock || 0) - reserved));
                const reorder = Number(item.reorder_level || 0);
                const status = STATUS_STYLE[item.status] ?? STATUS_STYLE.inactive;
                const locStock = itemLocationStock[item.id];
                const locTotal = locStock?.reduce((sum, loc) => sum + loc.stock, 0) ?? 0;
                // Viewing one location shows a subset of the item total — not a desync.
                const outOfSync = !!locStock?.length && !globalLocationId && locTotal !== (item.current_stock || 0);
                // Stock recorded on the item but not allocated to any bin.
                const unallocated = (item.current_stock || 0) > 0 && !(item.bins && item.bins.length > 0);
                const onHand = locStock?.length ? locTotal : Number(item.current_stock || 0);
                return (
                <TableRow
                  key={item.id}
                  aria-rowindex={idx + 1}
                  data-state={selectedItemIds.has(item.id) ? 'selected' : undefined}
                  className="group h-[60px] border-border/50 hover:bg-[hsl(220_20%_98.3%)] data-[state=selected]:bg-[hsl(213_70%_97%)]"
                >
                  <TableCell className="pl-4">
                    <Checkbox
                      aria-label={`Select ${item.name}`}
                      checked={selectedItemIds.has(item.id)}
                      onCheckedChange={() => toggleSelectItem(item.id)}
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex min-w-[240px] max-w-[440px] items-center gap-3">
                      {col('photo') && (
                        <button
                          type="button"
                          disabled={!item.image_url}
                          aria-label={item.image_url ? `Preview photo of ${item.name}` : `No photo for ${item.name}`}
                          onClick={() => item.image_url && setPreviewImage({ url: item.image_url, name: item.name })}
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/60',
                            item.image_url && 'cursor-zoom-in transition-shadow hover:ring-2 hover:ring-primary/40',
                          )}
                        >
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                (e.currentTarget.parentElement?.querySelector('.placeholder-icon') as HTMLElement)?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <ImageIcon className={cn('placeholder-icon h-4 w-4 text-muted-foreground/70', item.image_url && 'hidden')} />
                        </button>
                      )}
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setViewingItem(item)}
                          className="block max-w-full truncate text-left font-medium text-foreground hover:text-primary hover:underline"
                          title={item.description ? `${item.name} — ${item.description}` : item.name}
                        >
                          {item.name}
                        </button>
                        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                          {col('item_code') && <span className="shrink-0 font-mono">{item.item_code}</span>}
                          {item.description && (
                            <span className="truncate">{col('item_code') ? '· ' : ''}{item.description}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  {col('category') && (
                    <TableCell>
                      {item.category_id && categoryById.get(item.category_id)?.name ? (
                        <span className="inline-flex max-w-[180px] truncate rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/80">
                          {categoryById.get(item.category_id)?.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                  {col('unit') && (
                    <TableCell className="text-sm text-muted-foreground">
                      {item.unit_id ? unitById.get(item.unit_id)?.abbreviation || '—' : '—'}
                    </TableCell>
                  )}
                  {col('bin') && (
                    <TableCell>
                      {item.bins && item.bins.length > 0 ? (
                        <TooltipProvider>
                          <div className="flex flex-wrap items-center gap-1">
                            {item.bins.slice(0, 2).map(bin => {
                              const binReserved = Number(bin.reserved_quantity ?? 0);
                              const allocated = Number(bin.allocated_quantity ?? bin.quantity);
                              return (
                                <Tooltip key={bin.id}>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex cursor-help items-center gap-1 whitespace-nowrap rounded-full border border-border/70 bg-background px-2 py-0.5 text-xs">
                                      <Package className="h-3 w-3 text-muted-foreground" />
                                      <span className="font-medium">{bin.bin_code}</span>
                                      <span className="tabular-nums text-muted-foreground">{fmtQty(Number(bin.quantity))}</span>
                                      {binReserved > 0 && <span className="text-amber-600">· {fmtQty(binReserved)} resv</span>}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{bin.name} — Allocated: {allocated}, Reserved: {binReserved}, Available: {bin.quantity}</p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                            {item.bins.length > 2 && (
                              <span className="text-xs text-muted-foreground">+{item.bins.length - 2}</span>
                            )}
                          </div>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                  {col('stock_owner') && (
                    <TableCell>
                      {item.stock_owners && item.stock_owners.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.stock_owners.map((n, i) => (
                            <span
                              key={`${n}-${i}`}
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs',
                                n === 'Unassigned' ? 'border border-dashed border-border text-muted-foreground' : 'bg-primary/10 text-primary',
                              )}
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  )}
                  {col('current_stock') && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {(outOfSync || unallocated) && (
                          <span
                            className="text-amber-500"
                            title={
                              outOfSync
                                ? `DB shows ${item.current_stock || 0}, allocations total ${locTotal}. Run Reconcile Stock to fix.`
                                : `Stock exists (${item.current_stock}) but no bin allocations. Run Reconcile Stock to fix.`
                            }
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setStockDetailsItem(item)}
                          title="View stock details"
                          className={cn(
                            'rounded-md px-1 font-semibold tabular-nums hover:bg-muted',
                            onHand <= reorder ? 'text-destructive' : onHand <= Number(item.min_stock_level || 0) ? 'text-amber-600' : 'text-foreground',
                          )}
                        >
                          {fmtQty(onHand)}
                        </button>
                      </div>
                      {locStock?.length ? (
                        <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="max-w-[120px] truncate">{locStock[0].locationName}</span>
                        </div>
                      ) : null}
                    </TableCell>
                  )}
                  {col('reserved') && (
                    <TableCell className={cn('text-right tabular-nums', reserved > 0 ? 'font-medium text-amber-600' : 'text-muted-foreground')}>
                      {fmtQty(reserved)}
                    </TableCell>
                  )}
                  {col('available') && (
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-end gap-2">
                        {available <= 0 ? (
                          <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-600">Out</span>
                        ) : reorder > 0 && available <= reorder ? (
                          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">Low</span>
                        ) : null}
                        <span className={cn('font-semibold tabular-nums', available <= 0 ? 'text-red-600' : 'text-foreground')}>
                          {fmtQty(available)}
                        </span>
                      </span>
                    </TableCell>
                  )}
                  {col('unit_cost') && (
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-sm">
                      {item.unit_cost ? formatCurrency(Number(item.unit_cost)) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  {col('status') && (
                    <TableCell>
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset', status.pill)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                        {item.status}
                      </span>
                    </TableCell>
                  )}
                  <TableCell className="sticky right-0 bg-card pr-3 shadow-[inset_1px_0_0_hsl(var(--border)/0.6)] group-hover:bg-[hsl(220_20%_98.3%)] group-data-[state=selected]:bg-[hsl(213_70%_97%)]">
                    <div className="flex items-center justify-end gap-0.5">
                      <button type="button" className={iconBtn} onClick={() => setViewingItem(item)} title="View details" aria-label={`View ${item.name}`}>
                        <Eye className="h-4 w-4" />
                      </button>
                      <button type="button" className={iconBtn} onClick={() => setTransferItem(item)} title="Transfer between warehouses" aria-label={`Transfer ${item.name}`}>
                        <ArrowLeftRight className="h-4 w-4" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className={iconBtn} aria-label={`More actions for ${item.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl">
                          <DropdownMenuItem onClick={() => setStockAdjustmentItem(item)}>
                            <SlidersHorizontal className="mr-2 h-4 w-4" /> Adjust stock
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStockMovementItem(item)}>
                            <History className="mr-2 h-4 w-4" /> Movement history
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStockDetailsItem(item)}>
                            <BarChart3 className="mr-2 h-4 w-4" /> Stock by location
                          </DropdownMenuItem>
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeletingItem(item)}
                                disabled={isDeleting || isMarkingInactive}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Remove from inventory
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
                );
              };
              if (!shouldVirtualize) {
                return filteredItems.map((item, idx) => renderRow(item, idx));
              }
              const totalSize = rowVirtualizer.getTotalSize();
              const paddingTop = virtualItems[0]?.start ?? 0;
              const paddingBottom = totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0);
              return (
                <>
                  {paddingTop > 0 && (
                    <tr aria-hidden style={{ height: paddingTop }}>
                      <td colSpan={colSpan} />
                    </tr>
                  )}
                  {virtualItems.map((vi) => renderRow(filteredItems[vi.index], vi.index))}
                  {paddingBottom > 0 && (
                    <tr aria-hidden style={{ height: paddingBottom }}>
                      <td colSpan={colSpan} />
                    </tr>
                  )}
                </>
              );
            })())}
          </TableBody>
        </Table>
        </div>

        {/* Infinite scroll sentinel (same placement as before the redesign) */}
        <div ref={sentinelRef} className="h-1" />

        {isFetchingNextPage && (
          <div className="flex items-center justify-center gap-2 border-t border-border/50 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more items…
          </div>
        )}

        {!hasNextPage && totalLoaded > 0 && !isLoading && (
          <div className="border-t border-border/50 py-2.5 text-center text-xs text-muted-foreground">
            All {totalLoaded.toLocaleString('en-US')} items loaded
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
        <div
          role="toolbar"
          aria-label="Bulk actions for selected items"
          className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-2xl bg-slate-900 px-2.5 py-2 text-white shadow-2xl shadow-slate-900/30"
        >
          <span className="mr-1 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-sm font-medium">
            <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-white px-1 text-xs font-bold tabular-nums text-slate-900">
              {selectedItemIds.size}
            </span>
            selected
          </span>
          <Button size="sm" className="h-8 rounded-xl bg-white text-slate-900 hover:bg-white/90" onClick={() => setIsBulkIssueOpen(true)}>
            <PackageCheck className="mr-1.5 h-4 w-4" /> Bulk issue
          </Button>
          <Button size="sm" variant="ghost" className="h-8 rounded-xl text-white hover:bg-white/10 hover:text-white" onClick={() => setIsBulkUpdateOpen(true)}>
            <PencilLine className="mr-1.5 h-4 w-4" /> Update
          </Button>
          <Button size="sm" variant="ghost" className="h-8 rounded-xl text-white hover:bg-white/10 hover:text-white" onClick={() => setIsBulkChangeOwnerOpen(true)}>
            <UserCog className="mr-1.5 h-4 w-4" /> Change owner
          </Button>
          {canDelete && (
            <Button size="sm" variant="ghost" className="h-8 rounded-xl text-red-300 hover:bg-red-500/20 hover:text-red-200" onClick={() => setIsBulkDeleteOpen(true)}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-white/70 hover:bg-white/10 hover:text-white" onClick={clearSelection} aria-label="Clear selection">
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
      {isBulkIssueOpen && (
        <Suspense fallback={null}>
          <BulkIssueFromInventoryDialog
            open={isBulkIssueOpen}
            onOpenChange={setIsBulkIssueOpen}
            selectedItems={selectedItems as any}
            defaultLocationId={globalLocationId || null}
            onComplete={clearSelection}
          />
        </Suspense>
      )}
    </div>
  );
}
