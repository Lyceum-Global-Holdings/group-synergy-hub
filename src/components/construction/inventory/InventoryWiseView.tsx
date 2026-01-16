import { useState } from "react";
import { Eye, MapPin, Search } from "lucide-react";
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
  section: InventorySection;
  category: InventoryCategory;
  totalQty: number;
  status: ComputedStatus;
  locations: string[];
  itemName: string;
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

  const { data: resources, isLoading } = useConstructionResources();

  // Filter for material resources only
  const materialResources = resources?.filter((r) => r.resource_type === "material") || [];

  // Transform resources into inventory-wise rows
  // Group by item name and aggregate data
  const inventoryData: InventoryWiseRow[] = Object.entries(
    materialResources.reduce((acc, resource) => {
      const key = resource.resource_name;
      if (!acc[key]) {
        acc[key] = {
          id: resource.id,
          itemName: resource.resource_name,
          totalQty: 0,
          locations: new Set<string>(),
          statuses: [] as string[],
          // Derive section and category from description or notes (could be enhanced)
          section: deriveSection(resource.description || resource.notes || ""),
          category: deriveCategory(resource.description || resource.notes || ""),
        };
      }
      acc[key].totalQty += resource.quantity_allocated || 0;
      if (resource.project?.project_name) {
        acc[key].locations.add(resource.project.project_name);
      }
      acc[key].statuses.push(resource.status);
      return acc;
    }, {} as Record<string, { id: string; itemName: string; totalQty: number; locations: Set<string>; statuses: string[]; section: InventorySection; category: InventoryCategory }>)
  ).map(([_, data]) => ({
    id: data.id,
    section: data.section,
    category: data.category,
    totalQty: data.totalQty,
    status: computeStatus(data.statuses, data.totalQty),
    locations: Array.from(data.locations),
    itemName: data.itemName,
  }));

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
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No inventory items found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.itemName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {INVENTORY_SECTIONS.find(s => s.value === row.section)?.label || row.section}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {INVENTORY_CATEGORIES.find(c => c.value === row.category)?.label || row.category}
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

// Helper function to derive section from text (can be enhanced with actual data mapping)
function deriveSection(text: string): InventorySection {
  const lowerText = text.toLowerCase();
  if (lowerText.includes("civil")) return "civil";
  if (lowerText.includes("mechanical")) return "mechanical";
  if (lowerText.includes("carpenter") || lowerText.includes("wood")) return "carpenter";
  if (lowerText.includes("mep") || lowerText.includes("electrical") || lowerText.includes("plumbing")) return "mep";
  if (lowerText.includes("aluminium") || lowerText.includes("aluminum")) return "aluminium";
  // Default based on hash for demo variety
  const sections = INVENTORY_SECTIONS.map(s => s.value);
  return sections[Math.abs(hashCode(text)) % sections.length];
}

// Helper function to derive category from text (can be enhanced with actual data mapping)
function deriveCategory(text: string): InventoryCategory {
  const lowerText = text.toLowerCase();
  if (lowerText.includes("machine")) return "machines";
  if (lowerText.includes("tool")) return "tools";
  if (lowerText.includes("equipment")) return "equipments";
  if (lowerText.includes("scaffold")) return "scaffolding";
  if (lowerText.includes("material")) return "materials";
  if (lowerText.includes("safety") || lowerText.includes("ppe")) return "safety";
  // Default based on hash for demo variety
  const categories = INVENTORY_CATEGORIES.map(c => c.value);
  return categories[Math.abs(hashCode(text)) % categories.length];
}

// Simple hash function for consistent pseudo-random assignment
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
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
