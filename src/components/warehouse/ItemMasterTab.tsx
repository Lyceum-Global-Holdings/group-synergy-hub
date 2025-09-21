import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, History, Settings } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useWarehouseItems } from '@/hooks/useWarehouseItems';
import { useItemCategories } from '@/hooks/useItemCategories';
import { useItemUnits } from '@/hooks/useItemUnits';
import { useCompany } from '@/contexts/CompanyContext';
import { CreateItemDialog } from '@/components/warehouse/CreateItemDialog';
import { StockMovementDialog } from '@/components/warehouse/StockMovementDialog';
import { StockAdjustmentDialog } from '@/components/warehouse/StockAdjustmentDialog';
import { WarehouseItem } from '@/types/itemBin';

export function ItemMasterTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [stockMovementItem, setStockMovementItem] = useState<WarehouseItem | null>(null);
  const [stockAdjustmentItem, setStockAdjustmentItem] = useState<WarehouseItem | null>(null);
  
  const { items, isLoading, deleteItem, isDeleting } = useWarehouseItems();
  const { categories } = useItemCategories();
  const { units } = useItemUnits();
  const { companies } = useCompany();

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
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
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
                    <div className="flex items-center justify-end gap-1">
                      <span className={`font-medium ${
                        item.current_stock <= (item.reorder_level || 0) ? 'text-red-600' : 
                        item.current_stock <= (item.min_stock_level || 0) ? 'text-yellow-600' : 
                        'text-green-600'
                      }`}>
                        {item.current_stock || 0}
                      </span>
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
                  </TableCell>
                  <TableCell>{item.unit_cost ? `$${item.unit_cost}` : '-'}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(item.status)}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingItem(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteItem(item.id)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
    </div>
  );
}