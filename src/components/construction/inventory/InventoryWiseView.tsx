import { useState } from "react";
import { Eye, MapPin, Search, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { useConstructionResources } from "@/hooks/construction/useConstructionResources";
import { useInventoryMaster } from "@/hooks/construction/useInventoryMaster";

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

interface InventoryWiseRow {
  id: string;
  section: string;
  category: string;
  totalQty: number;
  status: ComputedStatus;
  locations: string[];
  itemName: string;
  imageUrl?: string | null;
}

interface LocationDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  locations: string[];
}

function LocationDetailsDialog({ open, onOpenChange, itemName, locations }: LocationDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Details - {itemName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {locations.length === 0 ? (
            <p className="text-muted-foreground text-sm">No locations assigned</p>
          ) : (
            <div className="space-y-2">
              {locations.map((location, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{location}</span>
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
  const [locationDialog, setLocationDialog] = useState<{ open: boolean; itemName: string; locations: string[] }>({
    open: false,
    itemName: "",
    locations: [],
  });

  // Fetch from Item Master (source of truth)
  const { data: inventoryMaster, isLoading: isLoadingMaster } = useInventoryMaster();
  // Fetch allocation data for quantities and locations
  const { data: resources, isLoading: isLoadingResources } = useConstructionResources();

  const isLoading = isLoadingMaster || isLoadingResources;

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

  // Transform Item Master data into inventory-wise rows
  // Item Master is the single source of truth
  const inventoryData: InventoryWiseRow[] = (inventoryMaster || []).map((item) => {
    const allocationKey = item.item_name.toLowerCase().trim();
    const allocation = allocationDataMap[allocationKey];

    return {
      id: item.id,
      itemName: item.item_name,
      section: item.section || "unassigned",
      category: item.category || "unassigned",
      totalQty: allocation?.totalQty || 0,
      status: allocation ? computeStatus(allocation.statuses, allocation.totalQty) : "available",
      locations: allocation ? Array.from(allocation.locations) : [],
      imageUrl: item.image_url,
    };
  });

  // Apply filters
  const filteredData = inventoryData.filter((row) => {
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

  const handleViewLocations = (itemName: string, locations: string[]) => {
    setLocationDialog({ open: true, itemName, locations });
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
                    <TableRow key={row.id}>
                      <TableCell>
                        {row.imageUrl ? (
                          <img
                            src={row.imageUrl}
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
                          onClick={() => handleViewLocations(row.itemName, row.locations)}
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {row.locations.length} location{row.locations.length !== 1 ? "s" : ""}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewLocations(row.itemName, row.locations)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Location Details Dialog */}
      <LocationDetailsDialog
        open={locationDialog.open}
        onOpenChange={(open) => setLocationDialog(prev => ({ ...prev, open }))}
        itemName={locationDialog.itemName}
        locations={locationDialog.locations}
      />
    </div>
  );
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
  if (totalQty > 0 && totalQty < 10) {
    return "low_stock";
  }
  // Default to available
  return "available";
}
