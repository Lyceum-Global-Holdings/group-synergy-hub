import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, History, Settings, Eye, ArrowLeftRight, MapPin, BarChart3, Wrench } from 'lucide-react';
import { BulkItemImportDialog } from '@/components/warehouse/BulkItemImportDialog';
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
import { useWarehouseItems } from '@/hooks/useWarehouseItems';
import { useItemCategories } from '@/hooks/useItemCategories';
import { useItemUnits } from '@/hooks/useItemUnits';
import { useCompany } from '@/contexts/CompanyContext';
import { CreateItemDialog } from '@/components/warehouse/CreateItemDialog';
import { StockMovementDialog } from '@/components/warehouse/StockMovementDialog';
import { StockAdjustmentDialog } from '@/components/warehouse/StockAdjustmentDialog';
import { DeleteItemConfirmationDialog } from '@/components/warehouse/DeleteItemConfirmationDialog';
import { ItemDetailsDialog } from '@/components/warehouse/ItemDetailsDialog';
import { ItemTransferDialog } from '@/components/warehouse/ItemTransferDialog';
import { ItemStockDetailsDialog } from '@/components/warehouse/ItemStockDetailsDialog';
import { WarehouseItem } from '@/types/itemBin';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeStockUpdates } from '@/hooks/useRealtimeStockUpdates';
import { useWarehouseBinAllocations } from '@/hooks/useWarehouseBinAllocations';
import { useIsAdminOrHigher } from '@/hooks/useIsAdminOrHigher';

interface LocationStock {
  locationId: string;
  locationName: string;
  stock: number;
}

interface ItemLocationStockMap {
  [itemId: string]: LocationStock[];
}

export function ItemMasterTab() {
  // Enable real-time stock updates
  useRealtimeStockUpdates();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [viewingItem, setViewingItem] = useState<WarehouseItem | null>(null);
  const [stockMovementItem, setStockMovementItem] = useState<WarehouseItem | null>(null);
  const [stockAdjustmentItem, setStockAdjustmentItem] = useState<WarehouseItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<WarehouseItem | null>(null);
  const [transferItem, setTransferItem] = useState<WarehouseItem | null>(null);
  const [stockDetailsItem, setStockDetailsItem] = useState<WarehouseItem | null>(null);
  
  const { 
    items, 
    isLoading, 
    deleteItem, 
    markItemInactive, 
    isDeleting, 
    isMarkingInactive 
  } = useWarehouseItems();
  const { categories } = useItemCategories();
  const { units } = useItemUnits();
  const { companies } = useCompany();
  const { migrateAllocationsToCorrectLocation, isMigrating, reconcileStock, isReconciling } = useWarehouseBinAllocations();
  const { canDelete } = useIsAdminOrHigher();

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
      const { data, error } = await supabase
        .from('warehouse_bin_allocations')
        .select(`
          warehouse_item_id,
          available_quantity,
          warehouse_bins!inner (
            location_id,
            warehouse_locations!inner (id, name)
          )
        `)
        .gt('available_quantity', 0);
      
      if (error) throw error;
      
      // Group by item_id and location_id
      const grouped: ItemLocationStockMap = {};
      
      data?.forEach((alloc: any) => {
        const itemId = alloc.warehouse_item_id;
        const locationId = alloc.warehouse_bins.location_id;
        const locationName = alloc.warehouse_bins.warehouse_locations.name;
        
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

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'discontinued': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            <>
              <Button 
                variant="outline" 
                onClick={() => reconcileStock()}
                disabled={isReconciling}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                {isReconciling ? 'Reconciling...' : 'Reconcile Stock'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => migrateAllocationsToCorrectLocation()}
                disabled={isMigrating}
              >
                <Wrench className="mr-2 h-4 w-4" />
                {isMigrating ? 'Fixing...' : 'Fix Allocations'}
              </Button>
            </>
          )}
          <BulkItemImportDialog />
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Current Stock</TableHead>
              <TableHead>Unit Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  Loading items...
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No items found. Create your first item to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.item_code}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>
                    {item.category_id 
                      ? categories.find(c => c.id === item.category_id)?.name || '-'
                      : '-'
                    }
                  </TableCell>
                  <TableCell>
                    {item.unit_id 
                      ? units.find(u => u.id === item.unit_id)?.abbreviation || '-'
                      : '-'
                    }
                  </TableCell>
                  <TableCell>{item.brand || '-'}</TableCell>
                  <TableCell>
                    {item.company_id 
                      ? companies.find(c => c.id === item.company_id)?.name || '-'
                      : 'All Companies'
                    }
                  </TableCell>
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
                  <TableCell>{item.unit_cost ? `LKR ${item.unit_cost}` : '-'}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(item.status)}>
                      {item.status}
                    </Badge>
                  </TableCell>
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
                        onClick={() => setEditingItem(item)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
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
      </div>

      <CreateItemDialog
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
    </div>
  );
}