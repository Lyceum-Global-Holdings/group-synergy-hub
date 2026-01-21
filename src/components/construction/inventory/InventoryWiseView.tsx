import { useState } from "react";
import { Eye, MapPin, Search, Image as ImageIcon, ChevronDown, Edit, ArrowRightLeft, Package, Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConstructionResources } from "@/hooks/construction/useConstructionResources";
import { useInventoryMaster } from "@/hooks/construction/useInventoryMaster";
import { useRepairRecords } from "@/hooks/construction/useRepairRecords";
import { AddStockDialog } from "@/components/construction/dialogs/AddStockDialog";
import { EditStockDialog } from "@/components/construction/dialogs/EditStockDialog";

// Predefined Section values
export const INVENTORY_SECTIONS = [
  { value: "civil", label: "Civil" },
  { value: "mechanical", label: "Mechanical" },
  { value: "carpenter", label: "Carpenter" },
  { value: "mep", label: "MEP" },
  { value: "aluminium", label: "Aluminium" },
] as const;

// Predefined Category values
export const INVENTORY_CATEGORIES = [
  { value: "machines", label: "Machines" },
  { value: "tools", label: "Tools" },
  { value: "equipments", label: "Equipments" },
  { value: "scaffolding", label: "Scaffolding" },
  { value: "materials", label: "Materials" },
  { value: "safety", label: "Safety" },
] as const;

export type InventorySection = typeof INVENTORY_SECTIONS[number]["value"];
export type InventoryCategory = typeof INVENTORY_CATEGORIES[number]["value"];

// Status computation based on allocation data
type ComputedStatus = "available" | "low_stock" | "in_use" | "under_repair";

const COMPUTED_STATUSES: { value: ComputedStatus; label: string; color: string }[] = [
  { value: "available", label: "Available", color: "bg-green-100 text-green-800" },
  { value: "low_stock", label: "Low Stock", color: "bg-yellow-100 text-yellow-800" },
  { value: "in_use", label: "In Use", color: "bg-blue-100 text-blue-800" },
  { value: "under_repair", label: "Under Repair", color: "bg-red-100 text-red-800" },
];

// Individual item record with location info
interface LocationItemRecord {
  id: string;
  quantity: number;
  locationId?: string;
  locationName?: string;
  imageUrl?: string | null;
}

// Aggregated inventory row grouped by item name
interface AggregatedInventoryRow {
  itemName: string;
  section: string;
  category: string;
  totalQty: number;
  status: ComputedStatus;
  locationCount: number;
  locationRecords: LocationItemRecord[];
  primaryImageUrl?: string | null;
}

interface LocationActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  locationRecords: LocationItemRecord[];
  onEditItem: (itemId: string) => void;
  onTransferItem: (itemId: string) => void;
  onAllocateItem: (itemId: string) => void;
}

function LocationActionsDialog({ 
  open, 
  onOpenChange, 
  itemName, 
  locationRecords,
  onEditItem,
  onTransferItem,
  onAllocateItem
}: LocationActionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {itemName} - Location Actions
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {locationRecords.length === 0 ? (
            <p className="text-muted-foreground text-sm">No locations assigned</p>
          ) : (
            <div className="space-y-2">
              {locationRecords.map((record, idx) => (
                <div key={record.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm font-medium">
                        {record.locationName || `Location ${idx + 1}`}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        Qty: {record.quantity}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditItem(record.id)}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onTransferItem(record.id)}
                      title="Transfer"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAllocateItem(record.id)}
                      title="Allocate"
                    >
                      <Package className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InventoryWiseView() {
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [addStockDialogOpen, setAddStockDialogOpen] = useState(false);
  const [editStockDialog, setEditStockDialog] = useState<{ open: boolean; itemId: string | null }>({
    open: false,
    itemId: null,
  });
  const [locationDialog, setLocationDialog] = useState<{ 
    open: boolean; 
    itemName: string; 
    locationRecords: LocationItemRecord[];
  }>({
    open: false,
    itemName: "",
    locationRecords: [],
  });

  // Fetch from Item Master (source of truth)
  const { data: inventoryMaster, isLoading: isLoadingMaster } = useInventoryMaster();
  // Fetch allocation data for quantities and locations
  const { data: resources, isLoading: isLoadingResources } = useConstructionResources();
  // Fetch repair records for items under repair
  const { data: repairRecords = [], isLoading: isLoadingRepairs } = useRepairRecords();

  const isLoading = isLoadingMaster || isLoadingResources || isLoadingRepairs;

  // Get active repair items (not returned or discarded)
  const activeRepairRecords = repairRecords.filter(r => 
    !['returned', 'discarded'].includes(r.repair_status)
  );

  // Filter for material resources only
  const materialResources = resources?.filter((r) => r.resource_type === "material") || [];

  // Build allocation data map by item name for lookup
  const allocationDataMap = materialResources.reduce((acc, resource) => {
    const key = resource.resource_name.toLowerCase().trim();
    if (!acc[key]) {
      acc[key] = {
        totalQty: 0,
        locations: new Set<string>(),
        statuses: [] as string[],
      };
    }
    acc[key].totalQty += resource.quantity_allocated || 0;
    if (resource.project?.project_name) {
      acc[key].locations.add(resource.project.project_name);
    }
    acc[key].statuses.push(resource.status);
    return acc;
  }, {} as Record<string, { totalQty: number; locations: Set<string>; statuses: string[] }>);

  // Group items by item name (case-insensitive, trimmed)
  const aggregatedInventory: AggregatedInventoryRow[] = (() => {
    const groupedMap = new Map<string, {
      items: Array<{
        id: string;
        quantity: number;
        locationId?: string;
        locationName?: string;
        section: string;
        category: string;
        imageUrl?: string | null;
      }>;
    }>();

    // Group all inventory items by normalized item name
    (inventoryMaster || []).forEach((item) => {
      const normalizedName = item.item_name.toLowerCase().trim();
      
      if (!groupedMap.has(normalizedName)) {
        groupedMap.set(normalizedName, { items: [] });
      }
      
      groupedMap.get(normalizedName)!.items.push({
        id: item.id,
        quantity: item.quantity ?? 0,
        locationId: item.location_id || undefined,
        locationName: item.warehouse_location?.name || undefined,
        section: item.section || "unassigned",
        category: item.category || "unassigned",
        imageUrl: item.image_url,
      });
    });

    // Convert grouped map to aggregated rows
    const result: AggregatedInventoryRow[] = [];
    
    groupedMap.forEach((group, normalizedName) => {
      const items = group.items;
      
      // Calculate total quantity across all locations
      const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
      
      // Get unique locations
      const uniqueLocations = new Map<string | undefined, LocationItemRecord>();
      items.forEach((item) => {
        const locationKey = item.locationId || `no-location-${item.id}`;
        if (!uniqueLocations.has(locationKey)) {
          uniqueLocations.set(locationKey, {
            id: item.id,
            quantity: item.quantity,
            locationId: item.locationId,
            locationName: item.locationName,
            imageUrl: item.imageUrl,
          });
        } else {
          // Same location, add quantity
          const existing = uniqueLocations.get(locationKey)!;
          existing.quantity += item.quantity;
        }
      });
      
      const locationRecords = Array.from(uniqueLocations.values());
      
      // Use the first item's section/category (they should be the same for same item name)
      const firstItem = items[0];
      
      // Get allocation data for status computation
      const allocation = allocationDataMap[normalizedName];
      const allStatuses = allocation?.statuses || [];
      
      // Find primary image (first non-null image)
      const primaryImageUrl = items.find(i => i.imageUrl)?.imageUrl;
      
      // Use original case from first item
      const originalItemName = (inventoryMaster || []).find(
        i => i.item_name.toLowerCase().trim() === normalizedName
      )?.item_name || normalizedName;
      
      result.push({
        itemName: originalItemName,
        section: firstItem.section,
        category: firstItem.category,
        totalQty,
        status: computeStatus(allStatuses, totalQty),
        locationCount: locationRecords.filter(r => r.locationName).length,
        locationRecords,
        primaryImageUrl,
      });
    });
    
    return result;
  })();

  // Apply filters
  const filteredData = aggregatedInventory.filter((row) => {
    const matchesSection = sectionFilter === "all" || row.section === sectionFilter;
    const matchesCategory = categoryFilter === "all" || row.category === categoryFilter;
    const matchesSearch = row.itemName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSection && matchesCategory && matchesSearch;
  });

  const getStatusBadge = (status: ComputedStatus) => {
    const statusConfig = COMPUTED_STATUSES.find((s) => s.value === status);
    return (
      <Badge className={statusConfig?.color || "bg-muted"}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const handleViewLocations = (itemName: string, locationRecords: LocationItemRecord[]) => {
    setLocationDialog({ open: true, itemName, locationRecords });
  };

  const handleEditItem = (itemId: string) => {
    setEditStockDialog({ open: true, itemId });
  };

  const handleTransferItem = (itemId: string) => {
    console.log("Transfer item:", itemId);
    // TODO: Navigate to transfer or open transfer dialog
  };

  const handleAllocateItem = (itemId: string) => {
    console.log("Allocate item:", itemId);
    // TODO: Navigate to allocate or open allocate dialog
  };

  const getSectionLabel = (section: string) => {
    const found = INVENTORY_SECTIONS.find(s => s.value === section);
    return found?.label || (section === "unassigned" ? "Unassigned" : section);
  };

  const getCategoryLabel = (category: string) => {
    const found = INVENTORY_CATEGORIES.find(c => c.value === category);
    return found?.label || (category === "unassigned" ? "Unassigned" : category);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by item name..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Select value={sectionFilter} onValueChange={setSectionFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Section" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sections</SelectItem>
            {INVENTORY_SECTIONS.map((section) => (
              <SelectItem key={section.value} value={section.value}>
                {section.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {INVENTORY_CATEGORIES.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Add Stock Button */}
        <Button onClick={() => setAddStockDialogOpen(true)} className="ml-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Stock
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Image</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Locations</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No inventory items found. Add items from Item Master.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((row) => (
                    <TableRow key={row.itemName}>
                      <TableCell>
                        {row.primaryImageUrl ? (
                          <img
                            src={row.primaryImageUrl}
                            alt={row.itemName}
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{row.itemName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getSectionLabel(row.section)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {getCategoryLabel(row.category)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {row.totalQty.toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-1 text-sm"
                          onClick={() => handleViewLocations(row.itemName, row.locationRecords)}
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {row.locationCount} location{row.locationCount !== 1 ? "s" : ""}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              Actions <ChevronDown className="h-4 w-4 ml-1" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Actions by Location</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {row.locationRecords.length === 0 ? (
                              <DropdownMenuItem disabled>
                                No locations available
                              </DropdownMenuItem>
                            ) : (
                              row.locationRecords.map((record, idx) => (
                                <div key={record.id}>
                                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal py-1">
                                    {record.locationName || `Location ${idx + 1}`} (Qty: {record.quantity})
                                  </DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => handleEditItem(record.id)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleTransferItem(record.id)}>
                                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                                    Transfer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAllocateItem(record.id)}>
                                    <Package className="h-4 w-4 mr-2" />
                                    Allocate
                                  </DropdownMenuItem>
                                  {idx < row.locationRecords.length - 1 && <DropdownMenuSeparator />}
                                </div>
                              ))
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Items Under Repair Section */}
      {activeRepairRecords.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="h-5 w-5 text-orange-600" />
              Items Under Repair
              <Badge variant="outline" className="ml-2 bg-orange-100 text-orange-700 border-orange-300">
                {activeRepairRecords.length} item{activeRepairRecords.length !== 1 ? 's' : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Image</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Service Provider</TableHead>
                  <TableHead>Sent Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeRepairRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {record.inventory_item?.image_url ? (
                        <img
                          src={record.inventory_item.image_url}
                          alt={record.item_name}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{record.item_name}</TableCell>
                    <TableCell className="text-right font-medium">{record.quantity}</TableCell>
                    <TableCell>{record.unit || '-'}</TableCell>
                    <TableCell>{record.warehouse_location?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge className={getRepairStatusColor(record.repair_status)}>
                        {record.repair_status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </TableCell>
                    <TableCell>{record.service_provider || '-'}</TableCell>
                    <TableCell>
                      {new Date(record.sent_date).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Location Actions Dialog */}
      <LocationActionsDialog
        open={locationDialog.open}
        onOpenChange={(open) => setLocationDialog(prev => ({ ...prev, open }))}
        itemName={locationDialog.itemName}
        locationRecords={locationDialog.locationRecords}
        onEditItem={handleEditItem}
        onTransferItem={handleTransferItem}
        onAllocateItem={handleAllocateItem}
      />

      {/* Add Stock Dialog */}
      <AddStockDialog
        open={addStockDialogOpen}
        onOpenChange={setAddStockDialogOpen}
      />

      {/* Edit Stock Dialog */}
      <EditStockDialog
        open={editStockDialog.open}
        onOpenChange={(open) => setEditStockDialog({ open, itemId: open ? editStockDialog.itemId : null })}
        itemId={editStockDialog.itemId}
      />
    </div>
  );
}

// Helper function for repair status badge colors
function getRepairStatusColor(status: string): string {
  switch (status) {
    case 'sent_for_repair':
      return 'bg-orange-100 text-orange-800';
    case 'in_repair':
      return 'bg-blue-100 text-blue-800';
    case 'repaired':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

// Compute status based on resource statuses and quantities
function computeStatus(statuses: string[], totalQty: number): ComputedStatus {
  // Check if any is under repair
  if (statuses.some(s => s === "released" || s === "completed")) {
    return "under_repair";
  }
  // Check if actively in use
  if (statuses.some(s => s === "active")) {
    return "in_use";
  }
  // Check for low stock
  if (totalQty === 0) {
    return "low_stock";
  }
  if (totalQty > 0 && totalQty < 10) {
    return "low_stock";
  }
  // Default to available
  return "available";
}
