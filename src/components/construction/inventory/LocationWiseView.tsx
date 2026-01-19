import { useState } from "react";
import { MapPin, Package, Search, Image as ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInventoryMaster } from "@/hooks/construction/useInventoryMaster";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Section and Category labels
const INVENTORY_SECTIONS = [
  { value: "civil", label: "Civil" },
  { value: "mechanical", label: "Mechanical" },
  { value: "carpenter", label: "Carpenter" },
  { value: "mep", label: "MEP" },
  { value: "aluminium", label: "Aluminium" },
];

const INVENTORY_CATEGORIES = [
  { value: "machines", label: "Machines" },
  { value: "tools", label: "Tools" },
  { value: "equipments", label: "Equipments" },
  { value: "scaffolding", label: "Scaffolding" },
  { value: "materials", label: "Materials" },
  { value: "safety", label: "Safety" },
];

export function LocationWiseView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  const { data: inventoryItems, isLoading: isLoadingItems } = useInventoryMaster();
  
  // Fetch all warehouse locations for the dropdown
  const { data: locations = [], isLoading: isLoadingLocations } = useQuery({
    queryKey: ["warehouse-locations-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_locations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const isLoading = isLoadingItems || isLoadingLocations;

  // Filter items that have a location assigned
  const itemsWithLocation = (inventoryItems || []).filter(item => item.location_id);
  
  // Apply search and location filters
  const filteredItems = itemsWithLocation.filter((item) => {
    const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = locationFilter === "all" || item.location_id === locationFilter;
    return matchesSearch && matchesLocation;
  });

  // Group items by location, then aggregate by item name within each location
  interface AggregatedItem {
    itemName: string;
    section: string | null;
    category: string | null;
    status: string;
    totalQuantity: number;
    unitCost: number | null;
    imageUrl: string | null;
  }

  const groupedByLocation = filteredItems.reduce((acc, item) => {
    const locationKey = item.location_id || "unassigned";
    const locationName = item.warehouse_location?.name || "Unknown Location";
    
    if (!acc[locationKey]) {
      acc[locationKey] = {
        locationName,
        locationId: locationKey,
        items: [] as typeof filteredItems,
        aggregatedItems: {} as Record<string, AggregatedItem>,
      };
    }
    acc[locationKey].items.push(item);
    
    // Aggregate by item name (case-insensitive, trimmed) within the same location
    const normalizedItemName = (item.item_name || "").trim().toLowerCase();
    
    if (!acc[locationKey].aggregatedItems[normalizedItemName]) {
      acc[locationKey].aggregatedItems[normalizedItemName] = {
        itemName: item.item_name,
        section: item.section,
        category: item.category,
        status: item.status,
        totalQuantity: 0,
        unitCost: item.unit_cost,
        imageUrl: item.image_url,
      };
    }
    
    // Sum quantities for items with the same name at the same location
    const qty = Number(item.quantity) || 0;
    acc[locationKey].aggregatedItems[normalizedItemName].totalQuantity += qty;
    
    // Keep the first non-null image
    if (!acc[locationKey].aggregatedItems[normalizedItemName].imageUrl && item.image_url) {
      acc[locationKey].aggregatedItems[normalizedItemName].imageUrl = item.image_url;
    }
    
    return acc;
  }, {} as Record<string, { locationName: string; locationId: string; items: typeof filteredItems; aggregatedItems: Record<string, AggregatedItem> }>);

  const getSectionLabel = (value: string | null) => {
    if (!value) return "-";
    return INVENTORY_SECTIONS.find(s => s.value === value)?.label || value;
  };

  const getCategoryLabel = (value: string | null) => {
    if (!value) return "-";
    return INVENTORY_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  const getStatusBadge = (status: string) => {
    const variant = status === "active" ? "default" : "secondary";
    return <Badge variant={variant}>{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search inventory items..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Filter by location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : Object.keys(groupedByLocation).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {itemsWithLocation.length === 0 
              ? "No inventory items with locations found. Add items with locations from Item Master."
              : "No inventory items match your search criteria."
            }
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {Object.entries(groupedByLocation).map(([locationId, location]) => {
            const totalQuantity = location.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const totalValue = location.items.reduce((sum, item) => {
              return sum + ((item.quantity || 0) * (item.unit_cost || 0));
            }, 0);

            return (
              <Card key={locationId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      {location.locationName}
                    </CardTitle>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{Object.keys(location.aggregatedItems).length} Items</p>
                        <p className="text-xs text-muted-foreground">At this location</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{totalQuantity.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total Qty</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Image</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.values(location.aggregatedItems).map((aggItem, idx) => (
                        <TableRow key={`${locationId}-${aggItem.itemName}-${idx}`}>
                          <TableCell>
                            {aggItem.imageUrl ? (
                              <img
                                src={aggItem.imageUrl}
                                alt={aggItem.itemName}
                                className="w-8 h-8 object-cover rounded"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                                <ImageIcon className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              {aggItem.itemName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{getSectionLabel(aggItem.section)}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{getCategoryLabel(aggItem.category)}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{aggItem.totalQuantity}</TableCell>
                          <TableCell className="text-right">
                            {aggItem.unitCost ? `$${aggItem.unitCost.toFixed(2)}` : "-"}
                          </TableCell>
                          <TableCell>{getStatusBadge(aggItem.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* Location Summary */}
                  <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Location Total:</span>
                    <div className="flex gap-6">
                      <span>
                        <strong>{totalQuantity.toLocaleString()}</strong> Total Qty
                      </span>
                      <span>
                        <strong>${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> Total Value
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
