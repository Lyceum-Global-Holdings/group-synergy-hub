import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Eye, History, Package, MapPin, X, Image as ImageIcon, Edit, Trash2, Download, Loader2, Columns3, ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DataCard, EmptyState, ROW_HOVER, SearchField, STICKY_TD, STICKY_TH, StatusPill, Toolbar,
  iconBtn, pillButton, pillTrigger, thButton, thClass,
} from '@/components/warehouse/master/masterUi';
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
const BulkItemMasterDialog = lazy(() =>
  import('@/components/warehouse/bulk-item-master/BulkItemMasterDialog').then(m => ({ default: m.BulkItemMasterDialog }))
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
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [viewingItem, setViewingItem] = useState<CatalogItem | null>(null);
  const [stockMovementItem, setStockMovementItem] = useState<CatalogItem | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(DEFAULT_VISIBLE);
  const [sortBy, setSortBy] = useState<'name' | 'item_code' | 'created_at'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const scrollParentRef = useRef<HTMLDivElement>(null);

  const handleSort = (key: 'name' | 'item_code' | 'created_at') => {
    if (sortBy === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
    if (scrollParentRef.current) scrollParentRef.current.scrollTop = 0;
  };

  const SortIcon = ({ k }: { k: 'name' | 'item_code' | 'created_at' }) => {
    if (sortBy !== k) return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 opacity-50" />;
    return sortDir === 'asc'
      ? <ArrowUp className="ml-1 inline h-3.5 w-3.5" />
      : <ArrowDown className="ml-1 inline h-3.5 w-3.5" />;
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const col = (key: ColumnKey) => visibleColumns[key];

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
  } = useWarehouseItemsLazy({ ...filterParams, sortBy, sortDir });

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

  // Count is non-critical for first paint — only fetch after the first page renders,
  // and treat it as fresh for 60s so typing/scrolling doesn't refire it.
  const countConfig = useWarehouseItemsCount(filterParams);
  const { data: totalCount = 0 } = useQuery({
    ...countConfig,
    enabled: items.length > 0,
    staleTime: 60_000,
  });

  // O(1) lookup maps — replaces O(N*M) categories.find / units.find in the row render.
  const categoryById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const unitById = useMemo(() => new Map(units.map(u => [u.id, u])), [units]);

  // Row virtualization — only visible rows are mounted regardless of how many pages loaded.
  const VIRTUALIZE_FROM = 50;
  const shouldVirtualize = items.length > VIRTUALIZE_FROM;
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? items.length : 0,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });

  // Drive infinite scroll from the virtualizer — prefetch when near the end.
  const virtualItems = rowVirtualizer.getVirtualItems();
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    if (shouldVirtualize) {
      const last = virtualItems[virtualItems.length - 1];
      if (last && last.index >= items.length - 10) {
        fetchNextPage();
      }
    }
  }, [virtualItems, items.length, hasNextPage, isFetchingNextPage, fetchNextPage, shouldVirtualize]);

  // Fallback sentinel for small datasets (non-virtualized path).
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (shouldVirtualize) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, shouldVirtualize]);

  const hasActiveFilters = categoryFilter !== 'all' || statusFilter !== 'all' || supplierFilter !== 'all';

  const fmt2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const optionalVisible = (['category', 'unit', 'unit_cost', 'selling_price', 'reorder_level', 'status'] as const).filter((k) => col(k)).length;
  const colSpan = 2 + optionalVisible; // item + actions

  const renderRow = useCallback((item: CatalogItem, idx: number) => {
    const category = categoryById.get(item.category_id ?? '');
    const unit = unitById.get(item.unit_id ?? '');
    return (
      <TableRow key={item.id} aria-rowindex={idx + 1} className={cn('group h-14 border-border/50', ROW_HOVER)}>
        <TableCell className="py-2 pl-4">
          <div className="flex min-w-[260px] max-w-[460px] items-center gap-3">
            {col('photo') && (
              <button
                type="button"
                disabled={!item.image_url}
                onClick={() => item.image_url && setPreviewImage({ url: item.image_url, name: item.name })}
                aria-label={item.image_url ? `Preview photo of ${item.name}` : `No photo for ${item.name}`}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/60',
                  item.image_url && 'cursor-zoom-in hover:ring-2 hover:ring-primary/40',
                )}
              >
                {item.image_url ? (
                  <img src={item.image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-4 w-4 text-muted-foreground/70" />
                )}
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
                {item.description && <span className="truncate">{col('item_code') ? '· ' : ''}{item.description}</span>}
              </div>
            </div>
          </div>
        </TableCell>
        {col('category') && (
          <TableCell>
            {category ? (
              <span className="inline-flex max-w-[200px] items-center gap-1.5 truncate rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/80" title={category.code ? `[${category.code}] ${category.name}` : category.name}>
                {category.code && <span className="font-mono text-[10px] text-muted-foreground">{category.code}</span>}
                <span className="truncate">{category.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </TableCell>
        )}
        {col('unit') && <TableCell className="text-sm text-muted-foreground">{unit?.abbreviation || '—'}</TableCell>}
        {col('unit_cost') && (
          <TableCell className="text-right tabular-nums">
            {item.unit_cost != null ? (
              item.last_purchase_date ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-4">
                        {fmt2(item.unit_cost)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">
                      <div className="font-medium">Last purchase price</div>
                      <div>{new Date(item.last_purchase_date).toLocaleDateString()}</div>
                      {item.last_purchase_grn_number && <div>GRN: {item.last_purchase_grn_number}</div>}
                      {item.last_purchase_supplier_name && <div>Supplier: {item.last_purchase_supplier_name}</div>}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                fmt2(item.unit_cost)
              )
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </TableCell>
        )}
        {col('selling_price') && (
          <TableCell className="text-right tabular-nums">
            {item.selling_price != null ? fmt2(item.selling_price) : <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {col('reorder_level') && (
          <TableCell className="text-right tabular-nums">
            {item.reorder_level ?? <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {col('status') && (
          <TableCell>
            <StatusPill status={item.status || 'active'} />
          </TableCell>
        )}
        <TableCell className={cn('pr-3', STICKY_TD)}>
          <div className="flex items-center justify-end gap-0.5">
            <button type="button" className={iconBtn} onClick={() => setViewingItem(item)} title="View details" aria-label={`View ${item.name}`}>
              <Eye className="h-4 w-4" />
            </button>
            <button type="button" className={iconBtn} onClick={() => setEditingItem(item)} title="Edit item" aria-label={`Edit ${item.name}`}>
              <Edit className="h-4 w-4" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={iconBtn} aria-label={`More actions for ${item.name}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl">
                <DropdownMenuItem onClick={() => onNavigateToInventory?.(item.id)}>
                  <Package className="mr-2 h-4 w-4" /> Show in inventory
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNavigateToBins?.(item.id)}>
                  <MapPin className="mr-2 h-4 w-4" /> Bin allocations
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStockMovementItem(item)}>
                  <History className="mr-2 h-4 w-4" /> Movement history
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeletingItem(item)}
                      disabled={isDeleting || isMarkingInactive}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete item
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
    );
  }, [categoryById, unitById, visibleColumns, canDelete, isDeleting, isMarkingInactive, onNavigateToInventory, onNavigateToBins]);

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
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="Search name, code, SKU or barcode…" />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={pillButton}>
                  <Columns3 className="mr-2 h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 space-y-1 rounded-xl p-2">
                {COLUMN_DEFS.filter(c => !c.fixed).map(colDef => (
                  <label key={colDef.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                    <Checkbox
                      checked={visibleColumns[colDef.key]}
                      onCheckedChange={() => toggleColumn(colDef.key)}
                    />
                    {colDef.label}
                  </label>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" className={pillButton} onClick={handleDownloadExcel} disabled={isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isExporting ? 'Exporting…' : 'Excel'}
            </Button>
            <Button variant="outline" size="sm" className={pillButton} onClick={() => setIsBulkOpen(true)}>
              <Layers className="mr-2 h-4 w-4" /> Bulk create
            </Button>
            <Button size="sm" className="h-9 rounded-full px-4" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add item
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
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className={pillTrigger(supplierFilter !== 'all')} aria-label="Supplier">
              <SelectValue placeholder="Supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
              {suppliers.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-full px-3 text-muted-foreground"
              onClick={() => { setCategoryFilter('all'); setStatusFilter('all'); setSupplierFilter('all'); }}
            >
              <X className="mr-1 h-4 w-4" /> Clear filters
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
            {totalCount > 0
              ? `${totalCount.toLocaleString('en-US')} item${totalCount === 1 ? '' : 's'}`
              : isLoading ? 'Loading…' : `${items.length.toLocaleString('en-US')} items`}
          </span>
        </div>
      </Toolbar>

      <DataCard
        footer={
          items.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Loaded {items.length.toLocaleString('en-US')}
                {totalCount ? ` of ${totalCount.toLocaleString('en-US')}` : ''} items
                {isFetchingNextPage && ' · loading more…'}
              </span>
              {hasNextPage && !isFetchingNextPage ? (
                <Button variant="outline" size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => fetchNextPage()}>
                  Load more
                </Button>
              ) : !hasNextPage ? (
                <span>All items loaded</span>
              ) : (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
            </div>
          ) : undefined
        }
      >
        <div
          ref={scrollParentRef}
          className="overflow-auto"
          style={{ maxHeight: 'max(420px, calc(100svh - 400px))' }}
          role="grid"
          aria-rowcount={items.length}
          aria-label="Item catalogue"
        >
          <Table className="min-w-full">
            <TableHeader className="sticky top-0 z-10 bg-[hsl(var(--surface-2))] shadow-[inset_0_-1px_0_hsl(var(--border))]">
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead className={cn(thClass, 'pl-4')}>
                  <span className="inline-flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className={thButton}
                      aria-sort={sortBy === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      Item<SortIcon k="name" />
                    </button>
                    {col('item_code') && (
                      <button
                        type="button"
                        onClick={() => handleSort('item_code')}
                        className={thButton}
                        aria-sort={sortBy === 'item_code' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        Code<SortIcon k="item_code" />
                      </button>
                    )}
                  </span>
                </TableHead>
                {col('category') && <TableHead className={thClass}>Category</TableHead>}
                {col('unit') && <TableHead className={thClass}>Unit</TableHead>}
                {col('unit_cost') && <TableHead className={cn(thClass, 'text-right')}>Unit cost</TableHead>}
                {col('selling_price') && <TableHead className={cn(thClass, 'text-right')}>Selling price</TableHead>}
                {col('reorder_level') && <TableHead className={cn(thClass, 'text-right')}>Reorder lvl</TableHead>}
                {col('status') && <TableHead className={thClass}>Status</TableHead>}
                <TableHead className={cn(thClass, STICKY_TH, 'w-28 pr-4 text-right')}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={`sk-${i}`} className="h-14 border-border/50 hover:bg-transparent">
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 animate-pulse rounded-xl bg-muted" />
                        <div className="space-y-1.5">
                          <div className="h-3.5 w-52 animate-pulse rounded bg-muted" />
                          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell colSpan={colSpan - 1}><div className="h-3.5 w-full max-w-md animate-pulse rounded bg-muted" /></TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={colSpan} className="p-0">
                    <EmptyState
                      icon={Package}
                      title={debouncedSearch || hasActiveFilters ? 'No items match' : 'No items yet'}
                      description={
                        debouncedSearch || hasActiveFilters
                          ? 'Try a different search or clear the filters.'
                          : 'Add your first item, or bulk-create many at once.'
                      }
                      action={
                        debouncedSearch || hasActiveFilters ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => { setSearchTerm(''); setCategoryFilter('all'); setStatusFilter('all'); setSupplierFilter('all'); }}
                          >
                            Clear search and filters
                          </Button>
                        ) : (
                          <Button size="sm" className="rounded-full" onClick={() => setIsCreateDialogOpen(true)}>
                            <Plus className="mr-1.5 h-4 w-4" /> Add item
                          </Button>
                        )
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : shouldVirtualize ? (
                <>
                  {(() => {
                    const vItems = rowVirtualizer.getVirtualItems();
                    const totalSize = rowVirtualizer.getTotalSize();
                    const paddingTop = vItems.length > 0 ? vItems[0].start : 0;
                    const paddingBottom = vItems.length > 0 ? totalSize - vItems[vItems.length - 1].end : 0;
                    return (
                      <>
                        {paddingTop > 0 && (
                          <TableRow style={{ height: paddingTop }} className="hover:bg-transparent">
                            <TableCell colSpan={colSpan} className="p-0" />
                          </TableRow>
                        )}
                        {vItems.map(v => renderRow(items[v.index], v.index))}
                        {paddingBottom > 0 && (
                          <TableRow style={{ height: paddingBottom }} className="hover:bg-transparent">
                            <TableCell colSpan={colSpan} className="p-0" />
                          </TableRow>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                items.map((item, idx) => renderRow(item, idx))
              )}
            </TableBody>
          </Table>
        </div>
        {/* Infinite-scroll sentinel (small, non-virtualised lists) */}
        <div ref={sentinelRef} className="h-px" />
      </DataCard>

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

      {viewingItem && (
        <Suspense fallback={null}>
          <ItemDetailsDialog
            item={viewingItem as any}
            open={!!viewingItem}
            onOpenChange={(open) => { if (!open) setViewingItem(null); }}
          />
        </Suspense>
      )}
      {isBulkOpen && (
        <Suspense fallback={null}>
          <BulkItemMasterDialog open={isBulkOpen} onOpenChange={setIsBulkOpen} />
        </Suspense>
      )}
    </div>
  );
}
