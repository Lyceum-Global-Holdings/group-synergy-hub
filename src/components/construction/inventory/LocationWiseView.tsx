import { useState, useMemo, useEffect } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Search, MapPin, Package, Trash2 } from "lucide-react";
import { useSerialNumbers, useInventoryStock, useLocations, useDeleteSerialNumber, useDeleteInventoryStock } from "@/hooks/construction/useConstructionInventory";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { DeleteConfirmDialog } from "@/components/construction/dialogs/DeleteConfirmDialog";

export function LocationWiseView() {
  const { globalLocationId } = useLocationFilter();
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>(globalLocationId || "all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "serial" | "stock"; id: string; name: string } | null>(null);

  const { data: isSuperAdmin } = useSuperAdmin();
  const deleteSerial = useDeleteSerialNumber();
  const deleteStock = useDeleteInventoryStock();

  // Sync from global context when it changes
  useEffect(() => {
    setLocationFilter(globalLocationId || "all");
  }, [globalLocationId]);

  const { data: locations, isLoading: locationsLoading } = useLocations();
  const { data: serials, isLoading: serialsLoading } = useSerialNumbers();
  const { data: stocks, isLoading: stocksLoading } = useInventoryStock();

  const isLoading = locationsLoading || serialsLoading || stocksLoading;

  // Group data by location
  const locationData = useMemo(() => {
    const result: Record<string, {
      location: { id: string; name: string };
      serials: any[];
      stocks: any[];
    }> = {};

    // Initialize with all locations
    locations?.forEach(loc => {
      result[loc.id] = {
        location: loc,
        serials: [],
        stocks: [],
      };
    });

    // Add serials to locations
    serials?.forEach(serial => {
      if (serial.current_location_id && result[serial.current_location_id]) {
        result[serial.current_location_id].serials.push(serial);
      }
    });

    // Add stocks to locations
    stocks?.forEach(stock => {
      if (stock.location_id && result[stock.location_id]) {
        result[stock.location_id].stocks.push(stock);
      }
    });

    return result;
  }, [locations, serials, stocks]);

  // Filter locations
  const filteredLocations = useMemo(() => {
    let filtered = Object.values(locationData);

    if (locationFilter !== "all") {
      filtered = filtered.filter(loc => loc.location.id === locationFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(loc => {
        const matchesLocation = loc.location.name.toLowerCase().includes(term);
        const matchesSerial = loc.serials.some(s => 
          s.serial_number.toLowerCase().includes(term) ||
          s.item_master?.item_name?.toLowerCase().includes(term)
        );
        const matchesStock = loc.stocks.some(s =>
          s.item_master?.item_name?.toLowerCase().includes(term)
        );
        return matchesLocation || matchesSerial || matchesStock;
      });
    }

    // Only show locations with inventory
    filtered = filtered.filter(loc => loc.serials.length > 0 || loc.stocks.length > 0);

    return filtered;
  }, [locationData, locationFilter, searchTerm]);

  const getConditionBadge = (condition: string) => {
    const variants: Record<string, string> = {
      working: "bg-green-100 text-green-800",
      under_repair: "bg-orange-100 text-orange-800",
      damaged: "bg-red-100 text-red-800",
      scrap: "bg-gray-100 text-gray-800",
    };
    return <Badge className={variants[condition] || ""}>{condition.replace(/_/g, " ")}</Badge>;
  };

  const handleDeleteClick = (type: "serial" | "stock", id: string, name: string) => {
    setDeleteTarget({ type, id, name });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "serial") {
      deleteSerial.mutate(deleteTarget.id, { onSettled: () => { setDeleteDialogOpen(false); setDeleteTarget(null); } });
    } else {
      deleteStock.mutate(deleteTarget.id, { onSettled: () => { setDeleteDialogOpen(false); setDeleteTarget(null); } });
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items or locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations?.map(loc => (
              <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Location Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : filteredLocations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium">No inventory at locations</h3>
            <p className="text-sm text-muted-foreground">
              Add stock or serial numbers to see location-wise inventory
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {filteredLocations.map(loc => (
            <AccordionItem key={loc.location.id} value={loc.location.id} className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-primary" />
                    <span className="font-medium">{loc.location.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {loc.serials.length > 0 && (
                      <Badge variant="outline">{loc.serials.length} machines</Badge>
                    )}
                    {loc.stocks.length > 0 && (
                      <Badge variant="secondary">{loc.stocks.length} items</Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4">
                  {/* Machines (Serial Numbers) */}
                  {loc.serials.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Machines (Serial Tracked)</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>Serial Number</TableHead>
                            <TableHead>Condition</TableHead>
                             <TableHead>Status</TableHead>
                            {isSuperAdmin && <TableHead className="w-[60px]">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loc.serials.map((serial: any) => (
                            <TableRow key={serial.id}>
                              <TableCell>{serial.item_master?.item_name || "-"}</TableCell>
                              <TableCell className="font-mono">{serial.serial_number}</TableCell>
                              <TableCell>{getConditionBadge(serial.condition)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {serial.availability.replace(/_/g, " ")}
                                </Badge>
                              </TableCell>
                              {isSuperAdmin && (
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteClick("serial", serial.id, serial.serial_number)}
                                    title="Delete serial number"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Non-Serial Items */}
                  {loc.stocks.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Other Items (Quantity)</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Reserved</TableHead>
                            {isSuperAdmin && <TableHead className="w-[60px]">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loc.stocks.map((stock: any) => (
                            <TableRow key={stock.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {stock.item_master?.image_url ? (
                                    <img src={stock.item_master.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                                  ) : (
                                    <Package className="h-8 w-8 p-1.5 bg-muted rounded" />
                                  )}
                                  <span>{stock.item_master?.item_name || "Unknown"}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {stock.item_master?.category}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {stock.quantity} {stock.item_master?.unit_of_measurement}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {stock.reserved_quantity || 0}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
