import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Search, Plus, Eye, History, Package, MapPin, X, Image as ImageIcon, Edit, Trash2, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useWarehouseItems } from '@/hooks/useWarehouseItems';
import { useWarehouseItemsPaged, fetchAllWarehouseItemsBatched } from '@/hooks/useWarehouseItemsPaged';
import { useItemCategories } from '@/hooks/useItemCategories';
import { useItemUnits } from '@/hooks/useItemUnits';
import { useCompany } from '@/contexts/CompanyContext';
import { AddItemsDialog } from '@/components/warehouse/AddItemsDialog';
import { StockMovementDialog } from '@/components/warehouse/StockMovementDialog';
import { StockMovementChart } from '@/components/warehouse/StockMovementChart';
import { DeleteItemConfirmationDialog } from '@/components/warehouse/DeleteItemConfirmationDialog';
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';
import { WarehouseItem } from '@/types/itemBin';

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
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [stockMovementItem, setStockMovementItem] = useState<WarehouseItem | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [deletingItem, setDeletingItem] = useState<WarehouseItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const pageSize = 100;

  // Debounce search to avoid excessive queries
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, categoryFilter, statusFilter, supplierFilter]);

  // Use mutations from the original hook (no list query needed)
  const { deleteItem, markItemInactive, isDeleting, isMarkingInactive } = useWarehouseItems({ skipCompanyFilter: true });
  const { canDelete } = useIsAdminOrHigher();
  const { selectedCompany } = useCompany();
  const { categories } = useItemCategories(selectedCompany?.id);
  const { units } = useItemUnits();
  const queryClient = useQueryClient();

  // Resolve supplier filter to supplier_id
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

  // Resolve category filter to category_id
  const selectedCategoryId = useMemo(() => {
    if (categoryFilter === 'all') return 'all';
    return categories.find(c => c.name === categoryFilter)?.id || 'all';
  }, [categoryFilter, categories]);

  // Server-side paged query
  const { data: pagedResult, isLoading } = useWarehouseItemsPaged({
    page: currentPage,
    pageSize,
    search: debouncedSearch,
    categoryId: selectedCategoryId,
    status: statusFilter,
    supplierId: selectedSupplierId,
  });

  const items = pagedResult?.items ?? [];
  const totalCount = pagedResult?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const showingFrom = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingTo = Math.min(currentPage * pageSize, totalCount);

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
        { header: 'Current Stock', key: 'current_stock', width: 14 },
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
          current_stock: item.current_stock ?? 0,
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
      {/* Stock Movement Chart */}
      <StockMovementChart />

      {/* Filters */}
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
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
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

      {/* Table */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Item Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Barcode / SKU</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Selling Price</TableHead>
              <TableHead className="text-right">Reorder Lvl</TableHead>
              <TableHead className="text-right">Current Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">Loading items...</TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">No items found</TableCell>
              </TableRow>
            ) : items.map(item => {
              const category = categories.find(c => c.id === item.category_id);
              const unit = units.find(u => u.id === item.unit_id);
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.image_url ? (
                      <button onClick={() => setPreviewImage({ url: item.image_url!, name: item.name })} className="cursor-pointer">
                        <img src={item.image_url} alt={item.name} className="h-8 w-8 rounded object-cover" />
                      </button>
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.item_code}</TableCell>
                  <TableCell className="font-medium max-w-[180px] truncate">{item.name}</TableCell>
                  <TableCell>{category?.name || '-'}</TableCell>
                  <TableCell>{unit?.abbreviation || '-'}</TableCell>
                  <TableCell>{item.brand || '-'}</TableCell>
                  <TableCell>{item.supplier?.name || '-'}</TableCell>
                  <TableCell className="text-xs">
                    {item.barcode || item.sku ? (
                      <div className="space-y-0.5">
                        {item.barcode && <div>{item.barcode}</div>}
                        {item.sku && <div className="text-muted-foreground">{item.sku}</div>}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right">{item.unit_cost?.toFixed(2) || '-'}</TableCell>
                  <TableCell className="text-right">{item.selling_price?.toFixed(2) || '-'}</TableCell>
                  <TableCell className="text-right">{item.reorder_level ?? '-'}</TableCell>
                  <TableCell className="text-right font-medium">{item.current_stock ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(item.status || 'active')}>
                      {item.status || 'active'}
                    </Badge>
                  </TableCell>
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

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {showingFrom}–{showingTo} of {totalCount.toLocaleString()} items
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AddItemsDialog
        open={isCreateDialogOpen || editingItem !== null}
        onOpenChange={(open) => {
          if (!open) { setIsCreateDialogOpen(false); setEditingItem(null); }
        }}
        editingItem={editingItem || undefined}
      />

      {stockMovementItem && (
        <StockMovementDialog
          open={!!stockMovementItem}
          onOpenChange={(open) => { if (!open) setStockMovementItem(null); }}
          itemId={stockMovementItem.id}
          itemName={stockMovementItem.name}
          currentStock={stockMovementItem.current_stock}
        />
      )}

      <DeleteItemConfirmationDialog
        open={!!deletingItem}
        onOpenChange={(open) => { if (!open) setDeletingItem(null); }}
        item={deletingItem}
        onConfirmDelete={(itemId, forceDelete) => deleteItem({ id: itemId, forceDelete })}
        onMarkInactive={markItemInactive}
        isLoading={isDeleting || isMarkingInactive}
      />

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
