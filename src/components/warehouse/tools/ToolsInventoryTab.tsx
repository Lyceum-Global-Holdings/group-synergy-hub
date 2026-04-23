import { useState, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { WarehouseTool } from "@/types/toolManagement";
import { MoreHorizontal, Pencil, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useCompany } from "@/contexts/CompanyContext";
import { buildToolCategoryOptions } from "@/features/tools/lib/toolCategories";
import { useIsAdminOrHigher } from "@/hooks/useIsAdminOrHigher";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ToolsInventoryTabProps {
  tools: WarehouseTool[];
  isLoading: boolean;
  onAdjustQuantity?: (tool: WarehouseTool) => void;
  onEditTool?: (tool: WarehouseTool) => void;
  onDeleteTool?: (tool: WarehouseTool) => void;
}

const createColumns = (
  onAdjustQuantity?: (tool: WarehouseTool) => void,
  onEditTool?: (tool: WarehouseTool) => void,
  onDeleteTool?: (tool: WarehouseTool) => void,
  canDelete: boolean = false,
): ColumnDef<WarehouseTool>[] => [
  {
    accessorKey: "tool_code",
    header: "Code",
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.getValue("tool_code")}</span>
    ),
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.getValue("name")}</div>
        {row.original.description && (
          <div className="text-sm text-muted-foreground truncate max-w-[200px]">
            {row.original.description}
          </div>
        )}
      </div>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => row.original.category?.name || "-",
  },
  {
    accessorKey: "location",
    header: "Location",
    cell: ({ row }) => row.original.location?.name || "-",
  },
  {
    accessorKey: "unit",
    header: "Unit",
    cell: ({ row }) => row.original.unit?.abbreviation || "-",
  },
  {
    accessorKey: "total_quantity",
    header: "Total",
    cell: ({ row }) => row.getValue("total_quantity"),
  },
  {
    accessorKey: "available_quantity",
    header: "Available",
    cell: ({ row }) => {
      const available = row.getValue("available_quantity") as number;
      const total = row.original.total_quantity;
      const percentage = total > 0 ? (available / total) * 100 : 0;
      
      return (
        <Badge variant={percentage > 50 ? "default" : percentage > 0 ? "secondary" : "destructive"}>
          {available}
        </Badge>
      );
    },
  },
  {
    accessorKey: "issued_quantity",
    header: "Issued",
    cell: ({ row }) => {
      const issued = row.getValue("issued_quantity") as number;
      return issued > 0 ? (
        <Badge variant="outline">{issued}</Badge>
      ) : (
        <span className="text-muted-foreground">0</span>
      );
    },
  },
  {
    accessorKey: "condition",
    header: "Condition",
    cell: ({ row }) => {
      const condition = row.getValue("condition") as string;
      const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
        good: "default",
        fair: "secondary",
        poor: "destructive",
        needs_repair: "outline",
      };
      return (
        <Badge variant={variants[condition] || "secondary"}>
          {condition.replace("_", " ")}
        </Badge>
      );
    },
  },
  {
    accessorKey: "unit_cost",
    header: "Unit Cost",
    cell: ({ row }) => {
      const cost = row.getValue("unit_cost") as number | null;
      return cost ? `$${cost.toFixed(2)}` : "-";
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const tool = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditTool?.(tool)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Tool
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAdjustQuantity?.(tool)}>
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Adjust Quantity
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export function ToolsInventoryTab({ tools, isLoading, onAdjustQuantity, onEditTool }: ToolsInventoryTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");

  const columns = createColumns(onAdjustQuantity, onEditTool);

  const { selectedCompany } = useCompany();
  const { allCategories } = useItemCategories(selectedCompany?.id);
  const categoryOptions = useMemo(
    () => buildToolCategoryOptions(allCategories),
    [allCategories],
  );

  // Locations are still derived from in-memory tool data (no master list needed here)
  const locations = useMemo(() => {
    const uniqueLocations = [...new Set(tools.map(t => t.location?.name).filter(Boolean))] as string[];
    return uniqueLocations.sort();
  }, [tools]);

  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      // Text search
      const query = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery.trim() ||
        tool.tool_code?.toLowerCase().includes(query) ||
        tool.name?.toLowerCase().includes(query) ||
        tool.description?.toLowerCase().includes(query) ||
        tool.category?.name?.toLowerCase().includes(query) ||
        tool.location?.name?.toLowerCase().includes(query);

      // Category filter (id-based)
      const matchesCategory = categoryFilter === "all" ||
        tool.category_id === categoryFilter;

      // Location filter
      const matchesLocation = locationFilter === "all" || 
        tool.location?.name === locationFilter;

      // Condition filter
      const matchesCondition = conditionFilter === "all" || 
        tool.condition === conditionFilter;

      // Availability filter
      const matchesAvailability = availabilityFilter === "all" ||
        (availabilityFilter === "in_stock" && tool.available_quantity > 0) ||
        (availabilityFilter === "out_of_stock" && tool.available_quantity === 0) ||
        (availabilityFilter === "partially_available" && 
          tool.available_quantity > 0 && tool.available_quantity < tool.total_quantity);

      return matchesSearch && matchesCategory && matchesLocation && 
             matchesCondition && matchesAvailability;
    });
  }, [tools, searchQuery, categoryFilter, locationFilter, conditionFilter, availabilityFilter]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setLocationFilter("all");
    setConditionFilter("all");
    setAvailabilityFilter("all");
  };

  const isFiltered = searchQuery.trim() !== "" || 
    categoryFilter !== "all" || 
    locationFilter !== "all" || 
    conditionFilter !== "all" || 
    availabilityFilter !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by code, name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categoryOptions.map(({ category, depth }) => (
              <SelectItem key={category.id} value={category.id}>
                <span className={depth === 1 ? "pl-4 text-muted-foreground" : "font-medium"}>
                  {depth === 1 ? "└ " : ""}
                  {category.code ? `[${category.code}] ` : ""}
                  {category.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map(loc => (
              <SelectItem key={loc} value={loc}>{loc}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={conditionFilter} onValueChange={setConditionFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conditions</SelectItem>
            <SelectItem value="good">Good</SelectItem>
            <SelectItem value="fair">Fair</SelectItem>
            <SelectItem value="poor">Poor</SelectItem>
            <SelectItem value="needs_repair">Needs Repair</SelectItem>
          </SelectContent>
        </Select>

        <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
            <SelectItem value="partially_available">Partial</SelectItem>
          </SelectContent>
        </Select>

        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Tools</div>
          <div className="text-2xl font-bold">
            {isFiltered ? `${filteredTools.length} / ${tools.length}` : tools.length}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Quantity</div>
          <div className="text-2xl font-bold">
            {filteredTools.reduce((sum, t) => sum + t.total_quantity, 0)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Available</div>
          <div className="text-2xl font-bold text-green-600">
            {filteredTools.reduce((sum, t) => sum + t.available_quantity, 0)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Currently Issued</div>
          <div className="text-2xl font-bold text-orange-600">
            {filteredTools.reduce((sum, t) => sum + t.issued_quantity, 0)}
          </div>
        </div>
      </div>

      <DataTable columns={columns} data={filteredTools} isLoading={isLoading} />
    </div>
  );
}