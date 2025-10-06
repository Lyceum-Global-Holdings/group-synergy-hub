import { useState } from "react";
import { Plus, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SupplierItemSelector } from "./SupplierItemSelector";
import { useSupplierItems, useCreateSupplierItem, useUpdateSupplierItem, useDeleteSupplierItem } from "@/hooks/useSupplierItems";
import { useWarehouseItems } from "@/hooks/useWarehouseItems";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

interface SupplierItemsSectionProps {
  supplierId: string;
}

export function SupplierItemsSection({ supplierId }: SupplierItemsSectionProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<{ id: string; supplier_id: string; warehouse_item_id: string } | null>(null);
  
  const { data: supplierItems, isLoading } = useSupplierItems(supplierId);
  const { items: warehouseItems } = useWarehouseItems();
  const createMutation = useCreateSupplierItem();
  const updateMutation = useUpdateSupplierItem();
  const deleteMutation = useDeleteSupplierItem();

  const existingItemIds = supplierItems?.map(si => si.warehouse_item_id) || [];

  const handleAddItems = () => {
    selectedItems.forEach(itemId => {
      createMutation.mutate({
        supplier_id: supplierId,
        warehouse_item_id: itemId,
        minimum_order_quantity: 0,
        lead_time_days: 0,
        is_preferred_supplier: false,
        status: 'active',
      });
    });
    setSelectedItems([]);
  };

  const handleUpdateField = (id: string, field: string, value: any) => {
    updateMutation.mutate({ id, [field]: value });
  };

  const handleDelete = () => {
    if (deleteItem) {
      deleteMutation.mutate(deleteItem);
      setDeleteItem(null);
    }
  };

  const getItemName = (itemId: string) => {
    const item = warehouseItems?.find(i => i.id === itemId);
    return item ? `${item.item_code} - ${item.name}` : 'Unknown Item';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Add Items to Supplier Catalog</Label>
        <SupplierItemSelector
          selectedItems={selectedItems}
          onItemsChange={setSelectedItems}
          excludeItemIds={existingItemIds}
        />
        {selectedItems.length > 0 && (
          <Button onClick={handleAddItems} className="w-full" disabled={createMutation.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Add {selectedItems.length} Item(s)
          </Button>
        )}
      </div>

      {supplierItems && supplierItems.length > 0 && (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Supplier Code</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>MOQ</TableHead>
                <TableHead>Lead Time</TableHead>
                <TableHead>Preferred</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplierItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.warehouse_item?.item_code}</span>
                      <span className="text-sm text-muted-foreground">{item.warehouse_item?.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {editingItem === item.id ? (
                      <Input
                        defaultValue={item.supplier_item_code || ''}
                        onBlur={(e) => {
                          handleUpdateField(item.id, 'supplier_item_code', e.target.value);
                          setEditingItem(null);
                        }}
                        autoFocus
                        className="w-32"
                      />
                    ) : (
                      <span onClick={() => setEditingItem(item.id)} className="cursor-pointer hover:underline">
                        {item.supplier_item_code || '-'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingItem === item.id ? (
                      <Input
                        type="number"
                        defaultValue={item.supplier_unit_price || ''}
                        onBlur={(e) => {
                          handleUpdateField(item.id, 'supplier_unit_price', parseFloat(e.target.value) || 0);
                          setEditingItem(null);
                        }}
                        className="w-24"
                      />
                    ) : (
                      <span onClick={() => setEditingItem(item.id)} className="cursor-pointer hover:underline">
                        {item.supplier_unit_price ? `$${item.supplier_unit_price.toFixed(2)}` : '-'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingItem === item.id ? (
                      <Input
                        type="number"
                        defaultValue={item.minimum_order_quantity}
                        onBlur={(e) => {
                          handleUpdateField(item.id, 'minimum_order_quantity', parseFloat(e.target.value) || 0);
                          setEditingItem(null);
                        }}
                        className="w-20"
                      />
                    ) : (
                      <span onClick={() => setEditingItem(item.id)} className="cursor-pointer hover:underline">
                        {item.minimum_order_quantity}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingItem === item.id ? (
                      <Input
                        type="number"
                        defaultValue={item.lead_time_days}
                        onBlur={(e) => {
                          handleUpdateField(item.id, 'lead_time_days', parseInt(e.target.value) || 0);
                          setEditingItem(null);
                        }}
                        className="w-20"
                      />
                    ) : (
                      <span onClick={() => setEditingItem(item.id)} className="cursor-pointer hover:underline">
                        {item.lead_time_days} days
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={item.is_preferred_supplier}
                      onCheckedChange={(checked) => handleUpdateField(item.id, 'is_preferred_supplier', checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteItem({ 
                        id: item.id, 
                        supplier_id: item.supplier_id, 
                        warehouse_item_id: item.warehouse_item_id 
                      })}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {supplierItems?.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No items added yet. Use the selector above to add items to this supplier's catalog.
        </div>
      )}

      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Item from Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this item from the supplier's catalog? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
