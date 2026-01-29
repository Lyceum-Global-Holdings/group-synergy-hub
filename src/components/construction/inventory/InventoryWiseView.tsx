import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, Package, Pencil, ChevronDown, Cog, Wrench, HardHat, Box, Construction } from "lucide-react";
import { useItemMaster, useSerialNumbers, useInventoryStock } from "@/hooks/construction/useConstructionInventory";
import { ITEM_CATEGORIES, type ItemCategory } from "@/types/construction-inventory";
import { Skeleton } from "@/components/ui/skeleton";
import { AddItemDialog } from "./AddItemDialog";
import { EditSerialLocationDialog } from "./EditSerialLocationDialog";

interface SerialData {
  id: string;
  serial_number: string;
  item_master_id: string;
  current_location_id?: string | null;
  condition: string;
  availability: string;
  location?: { id: string; name: string } | null;
}

// Category icons for the dropdown menu
const CATEGORY_ICONS: Record<ItemCategory, typeof Cog> = {
  machines: Cog,
  tools: Wrench,
  safety: HardHat,
  equipment: Box,
  scaffolding: Construction,
  others: Package,
};

export function InventoryWiseView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogCategory, setAddDialogCategory] = useState<ItemCategory>("machines");
  const [editSerialDialogOpen, setEditSerialDialogOpen] = useState(false);
  const [selectedSerial, setSelectedSerial] = useState<SerialData | null>(null);

  const { data: items, isLoading: itemsLoading } = useItemMaster(
    categoryFilter !== "all" ? (categoryFilter as ItemCategory) : undefined
  );
  const { data: serials, isLoading: serialsLoading } = useSerialNumbers();
  const { data: stocks, isLoading: stocksLoading } = useInventoryStock();

  const isLoading = itemsLoading || serialsLoading || stocksLoading;

  // Filter items by search term
  const filteredItems = items?.filter(item =>
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Group serials by item_master_id
  const serialsByItem = serials?.reduce((acc, serial) => {
    if (!acc[serial.item_master_id]) acc[serial.item_master_id] = [];
    acc[serial.item_master_id].push(serial);
    return acc;
  }, {} as Record<string, typeof serials>) || {};

  // Group stocks by item_master_id
  const stocksByItem = stocks?.reduce((acc, stock) => {
    if (!acc[stock.item_master_id]) acc[stock.item_master_id] = [];
    acc[stock.item_master_id].push(stock);
    return acc;
  }, {} as Record<string, typeof stocks>) || {};

  const getConditionBadge = (condition: string) => {
    const variants: Record<string, string> = {
      working: "bg-green-100 text-green-800",
      under_repair: "bg-orange-100 text-orange-800",
      damaged: "bg-red-100 text-red-800",
      scrap: "bg-gray-100 text-gray-800",
    };
    return <Badge className={variants[condition] || ""}>{condition.replace(/_/g, " ")}</Badge>;
  };

  const getAvailabilityBadge = (availability: string) => {
    const variants: Record<string, string> = {
      available: "bg-green-100 text-green-800",
      in_use: "bg-blue-100 text-blue-800",
      in_transit: "bg-yellow-100 text-yellow-800",
      reserved: "bg-purple-100 text-purple-800",
    };
    return <Badge className={variants[availability] || ""}>{availability.replace(/_/g, " ")}</Badge>;
  };

  const handleEditSerial = (serial: SerialData) => {
    setSelectedSerial(serial);
    setEditSerialDialogOpen(true);
  };

  const handleAddItem = (category: ItemCategory) => {
    setAddDialogCategory(category);
    setAddDialogOpen(true);
  };

  // Calculate total quantity for bulk items
  const getTotalQuantity = (itemId: string, unit: string) => {
    const itemStocks = stocksByItem[itemId] || [];
    const total = itemStocks.reduce((sum: number, stock: any) => sum + Number(stock.quantity), 0);
    return `${total} ${unit}`;
  };

  return (
    <div className="space-y-4">
      {/* Header with Add Item Dropdown */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by item name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {ITEM_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Category-specific Add Item Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {ITEM_CATEGORIES.map(cat => {
              const Icon = CATEGORY_ICONS[cat.value as ItemCategory];
              return (
                <DropdownMenuItem 
                  key={cat.value} 
                  onClick={() => handleAddItem(cat.value as ItemCategory)}
                  className="cursor-pointer"
                >
                  <Icon className="h-4 w-4 mr-2" />
                  Add {cat.label.slice(0, -1)}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Items List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium">No items found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm ? "Try a different search term" : "Add items to the Item Master to see them here"}
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Item
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48">
                {ITEM_CATEGORIES.map(cat => {
                  const Icon = CATEGORY_ICONS[cat.value as ItemCategory];
                  return (
                    <DropdownMenuItem 
                      key={cat.value} 
                      onClick={() => handleAddItem(cat.value as ItemCategory)}
                      className="cursor-pointer"
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      Add {cat.label.slice(0, -1)}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredItems.map(item => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.item_name} className="h-12 w-12 rounded object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-base">{item.item_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{item.item_code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{ITEM_CATEGORIES.find(c => c.value === item.category)?.label}</Badge>
                    {item.is_serial_tracked ? (
                      <Badge className="bg-purple-100 text-purple-800">Serial Tracked</Badge>
                    ) : (
                      <Badge className="bg-blue-100 text-blue-800">Bulk: {getTotalQuantity(item.id, item.unit_of_measurement)}</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {item.is_serial_tracked ? (
                  // Serial Number List for Machines
                  <div>
                    <h4 className="text-sm font-medium mb-2">Serial Numbers ({serialsByItem[item.id]?.length || 0})</h4>
                    {serialsByItem[item.id]?.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Serial Number</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Condition</TableHead>
                            <TableHead>Availability</TableHead>
                            <TableHead className="w-[60px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {serialsByItem[item.id].map((serial: any) => (
                            <TableRow key={serial.id}>
                              <TableCell className="font-mono">{serial.serial_number}</TableCell>
                              <TableCell>{serial.location?.name || "-"}</TableCell>
                              <TableCell>{getConditionBadge(serial.condition)}</TableCell>
                              <TableCell>{getAvailabilityBadge(serial.availability)}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditSerial(serial)}
                                  title="Edit location & status"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">No serial numbers registered</p>
                    )}
                  </div>
                ) : (
                  // Stock Quantities for Non-Serial Items (Bulk)
                  <div>
                    <h4 className="text-sm font-medium mb-2">Stock by Location</h4>
                    {stocksByItem[item.id]?.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {stocksByItem[item.id].map((stock: any) => (
                          <div key={stock.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <span className="text-sm">{stock.location?.name || "Unknown"}</span>
                            <Badge variant="secondary">
                              {stock.quantity} {item.unit_of_measurement}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No stock recorded</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Item Dialog */}
      <AddItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        category={addDialogCategory}
      />

      {/* Edit Serial Location Dialog */}
      <EditSerialLocationDialog
        open={editSerialDialogOpen}
        onOpenChange={setEditSerialDialogOpen}
        serial={selectedSerial}
      />
    </div>
  );
}
