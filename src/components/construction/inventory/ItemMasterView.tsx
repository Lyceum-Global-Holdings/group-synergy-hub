import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Plus, Package, Edit, Eye, Upload, Hash } from "lucide-react";
import { useItemMaster, useSerialNumbers, useInventoryStock } from "@/hooks/construction/useConstructionInventory";
import { ITEM_CATEGORIES, ITEM_SECTIONS, SUB_CATEGORIES, COLOR_OPTIONS, type ItemCategory, type ConstructionItemMaster } from "@/types/construction-inventory";
import { Skeleton } from "@/components/ui/skeleton";
import { AddItemDialog } from "./AddItemDialog";
import { BulkImportDialog } from "./BulkImportDialog";
import { ItemDetailsDialog } from "./ItemDetailsDialog";
import { EditItemDialog } from "./EditItemDialog";

// Bulk categories - these are quantity-tracked, not serial-tracked
const BULK_CATEGORIES: ItemCategory[] = ['tools', 'safety', 'equipment', 'scaffolding'];

export function ItemMasterView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<ItemCategory>("machines");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ConstructionItemMaster | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: items, isLoading } = useItemMaster(activeCategory);
  const { data: serialNumbers } = useSerialNumbers();
  const { data: stocks } = useInventoryStock();

  const isBulkCategory = BULK_CATEGORIES.includes(activeCategory);

  // Group serial numbers by item_master_id
  const serialsByItem = serialNumbers?.reduce((acc, serial) => {
    if (!acc[serial.item_master_id]) {
      acc[serial.item_master_id] = [];
    }
    acc[serial.item_master_id].push(serial);
    return acc;
  }, {} as Record<string, typeof serialNumbers>) || {};

  // Group stocks by item_master_id to calculate total quantity
  const stocksByItem = stocks?.reduce((acc, stock) => {
    if (!acc[stock.item_master_id]) {
      acc[stock.item_master_id] = [];
    }
    acc[stock.item_master_id].push(stock);
    return acc;
  }, {} as Record<string, typeof stocks>) || {};

  // Filter items by search
  const filteredItems = items?.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.item_name.toLowerCase().includes(term) ||
      item.item_code.toLowerCase().includes(term) ||
      item.brand?.toLowerCase().includes(term) ||
      item.model?.toLowerCase().includes(term)
    );
  }) || [];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
      scrap: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
      sold: "bg-muted text-muted-foreground",
    };
    return <Badge className={styles[status] || ""}>{status}</Badge>;
  };

  // Calculate total quantity for an item across all locations
  const getTotalQuantity = (itemId: string) => {
    const itemStocks = stocksByItem[itemId] || [];
    return itemStocks.reduce((sum: number, stock: any) => sum + Number(stock.quantity), 0);
  };

  const categoryLabel = ITEM_CATEGORIES.find(c => c.value === activeCategory)?.label || "Items";

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as ItemCategory)}>
        <TabsList className="w-full justify-start overflow-auto">
          {ITEM_CATEGORIES.map(cat => (
            <TabsTrigger key={cat.value} value={cat.value} className="flex-shrink-0">
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4 space-y-4">
          {/* Filters & Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, code, brand, or model..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import Data
              </Button>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add {categoryLabel.slice(0, -1)}
              </Button>
            </div>
          </div>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                {categoryLabel} Master
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium">No {activeCategory} found</h3>
                  <p className="text-sm text-muted-foreground">
                    Add items to the {categoryLabel} master
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Sub-Category</TableHead>
                      <TableHead>Color</TableHead>
                      {/* Show Serial Numbers for machines, Total Quantity for bulk categories */}
                      {activeCategory === "machines" ? (
                        <TableHead>Serial Numbers</TableHead>
                      ) : (
                        <TableHead>Total Quantity</TableHead>
                      )}
                      <TableHead>Section</TableHead>
                      <TableHead>Brand / Model</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map(item => {
                      const itemSerials = serialsByItem[item.id] || [];
                      const totalQuantity = getTotalQuantity(item.id);
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.image_url ? (
                              <img src={item.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                            ) : (
                              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono">{item.item_code}</TableCell>
                          <TableCell className="font-medium">
                            <div>{item.item_name}</div>
                          </TableCell>
                          <TableCell>
                            {item.sub_category ? (
                              <Badge variant="outline" className="text-xs">
                                {SUB_CATEGORIES[activeCategory]?.find(s => s.value === item.sub_category)?.label || item.sub_category}
                              </Badge>
                            ) : "-"}
                          </TableCell>
                          <TableCell>
                            {item.color ? (
                              <Badge variant="outline" className="text-xs">
                                {COLOR_OPTIONS.find(c => c.value === item.color)?.label || item.color}
                              </Badge>
                            ) : "-"}
                          </TableCell>
                          {/* Show Serial Numbers for machines, Total Quantity for bulk categories */}
                          {activeCategory === "machines" ? (
                            <TableCell>
                              {itemSerials.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {itemSerials.map(serial => (
                                    <Badge key={serial.id} variant="secondary" className="text-xs flex items-center gap-1">
                                      <Hash className="h-3 w-3" />
                                      {serial.serial_number}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">No serials</span>
                              )}
                            </TableCell>
                          ) : (
                            <TableCell>
                              <Badge variant="secondary" className="text-sm">
                                {totalQuantity} {item.unit_of_measurement}
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge variant="secondary">
                              {ITEM_SECTIONS.find(s => s.value === item.section)?.label || item.section}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.brand || item.model 
                              ? `${item.brand || ""} ${item.model || ""}`.trim()
                              : "-"
                            }
                          </TableCell>
                          <TableCell>{item.unit_of_measurement}</TableCell>
                          <TableCell className="text-right">
                            {item.unit_cost ? `₹${item.unit_cost.toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setDetailsDialogOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setEditDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </Tabs>

      {/* Dialogs */}
      <AddItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        category={activeCategory}
      />
      <BulkImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        category={activeCategory}
      />
      <ItemDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        item={selectedItem}
      />
      <EditItemDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        item={selectedItem}
      />
    </div>
  );
}
