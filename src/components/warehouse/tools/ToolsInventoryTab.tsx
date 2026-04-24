import { forwardRef, Fragment, useMemo, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WarehouseTool } from "@/types/toolManagement";
import {
  ChevronDown,
  ChevronRight,
  MapPin,
  MoreHorizontal,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useCompany } from "@/contexts/CompanyContext";
import { buildToolCategoryOptions } from "@/features/tools/lib/toolCategories";
import { useIsAdminOrHigher } from "@/hooks/useIsAdminOrHigher";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { ToolBinAllocationsPanel } from "./ToolBinAllocationsPanel";

interface ToolsInventoryTabProps {
  tools: WarehouseTool[];
  isLoading: boolean;
  onAdjustQuantity?: (tool: WarehouseTool) => void;
  onEditTool?: (tool: WarehouseTool) => void;
  onDeleteTool?: (tool: WarehouseTool) => void;
}

export const ToolsInventoryTab = forwardRef<HTMLDivElement, ToolsInventoryTabProps>(function ToolsInventoryTab(
  { tools, isLoading, onAdjustQuantity, onEditTool, onDeleteTool },
  ref,
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { canDelete } = useIsAdminOrHigher();
  const { selectedCompany } = useCompany();
  const { allCategories } = useItemCategories(selectedCompany?.id);
  const { globalLocationId, setGlobalLocationId } = useLocationFilter();
  const { locations } = useWarehouseLocations();

  const currentLocation = useMemo(
    () => locations.find((l) => l.id === globalLocationId) || null,
    [locations, globalLocationId]
  );

  const categoryOptions = useMemo(
    () => buildToolCategoryOptions(allCategories),
    [allCategories]
  );

  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery.trim() ||
        tool.tool_code?.toLowerCase().includes(query) ||
        tool.name?.toLowerCase().includes(query) ||
        tool.description?.toLowerCase().includes(query) ||
        tool.category?.name?.toLowerCase().includes(query) ||
        tool.location?.name?.toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === "all" || tool.category_id === categoryFilter;

      const matchesCondition =
        conditionFilter === "all" || tool.condition === conditionFilter;

      const matchesAvailability =
        availabilityFilter === "all" ||
        (availabilityFilter === "in_stock" && tool.available_quantity > 0) ||
        (availabilityFilter === "out_of_stock" && tool.available_quantity === 0) ||
        (availabilityFilter === "partially_available" &&
          tool.available_quantity > 0 &&
          tool.available_quantity < tool.total_quantity);

      return (
        matchesSearch && matchesCategory && matchesCondition && matchesAvailability
      );
    });
  }, [tools, searchQuery, categoryFilter, conditionFilter, availabilityFilter]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setConditionFilter("all");
    setAvailabilityFilter("all");
  };

  const isFiltered =
    searchQuery.trim() !== "" ||
    categoryFilter !== "all" ||
    conditionFilter !== "all" ||
    availabilityFilter !== "all";

  return (
    <div ref={ref} className="space-y-4">
      {/* Location scope banner */}
      {globalLocationId ? (
        <div className="flex items-center justify-between rounded-md border bg-card p-3">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Showing tools at:</span>
            <span className="font-medium">{currentLocation?.name ?? "Selected location"}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setGlobalLocationId(null)}
          >
            Show all locations
          </Button>
        </div>
      ) : (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
          Showing tools across all locations. Use the location selector in the header to focus on one site.
        </div>
      )}

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
          <div className="text-2xl font-bold">
            {filteredTools.reduce((sum, t) => sum + t.available_quantity, 0)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Currently Issued</div>
          <div className="text-2xl font-bold">
            {filteredTools.reduce((sum, t) => sum + t.issued_quantity, 0)}
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Issued</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Loading tools…
                </TableCell>
              </TableRow>
            ) : filteredTools.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  {globalLocationId
                    ? `No tools at ${currentLocation?.name ?? "this location"}. Create one or transfer from another site.`
                    : "No tools found."}
                </TableCell>
              </TableRow>
            ) : (
              filteredTools.map((tool) => {
                const expanded = expandedId === tool.id;
                const hasIssued = (tool.issued_quantity ?? 0) > 0;
                const showDelete = canDelete && !!onDeleteTool;
                return (
                  <Fragment key={tool.id}>
                    <TableRow>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setExpandedId(expanded ? null : tool.id)}
                          aria-label={expanded ? "Collapse" : "Expand bin allocations"}
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{tool.tool_code}</TableCell>
                      <TableCell>
                        <div className="font-medium">{tool.name}</div>
                        {tool.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-[240px]">
                            {tool.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{tool.category?.name || "-"}</TableCell>
                      <TableCell>
                        {tool.location?.name || (
                          <Badge variant="outline" className="text-xs">
                            Unassigned
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{tool.total_quantity}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            tool.available_quantity > 0 ? "default" : "destructive"
                          }
                        >
                          {tool.available_quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {tool.issued_quantity > 0 ? (
                          <Badge variant="outline">{tool.issued_quantity}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {(tool.condition || "").replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
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
                            {showDelete &&
                              (hasIssued ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>
                                        <DropdownMenuItem
                                          disabled
                                          className="text-destructive focus:text-destructive"
                                          onSelect={(e) => e.preventDefault()}
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Delete Tool
                                        </DropdownMenuItem>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      Return all issued units before deleting.
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => onDeleteTool?.(tool)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Tool
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow>
                        <TableCell colSpan={10} className="bg-muted/20 p-4">
                          <ToolBinAllocationsPanel tool={tool} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
});
