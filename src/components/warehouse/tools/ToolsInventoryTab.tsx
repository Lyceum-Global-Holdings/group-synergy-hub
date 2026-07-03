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
  Boxes,
  Trash2,
  X,
  Wrench,
  LayoutGrid,
  List,
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
import { ToolDetailsDialog } from "./ToolDetailsDialog";

interface ToolsInventoryTabProps {
  tools: WarehouseTool[];
  isLoading: boolean;
  onAdjustQuantity?: (tool: WarehouseTool) => void;
  onEditTool?: (tool: WarehouseTool) => void;
  onDeleteTool?: (tool: WarehouseTool) => void;
  onManageUnits?: (tool: WarehouseTool) => void;
}

export const ToolsInventoryTab = forwardRef<HTMLDivElement, ToolsInventoryTabProps>(function ToolsInventoryTab(
  { tools, isLoading, onAdjustQuantity, onEditTool, onDeleteTool, onManageUnits },
  ref,
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [viewTool, setViewTool] = useState<WarehouseTool | null>(null);

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

        <div className="ml-auto inline-flex rounded-md border p-0.5">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("list")}
            aria-label="List view"
            title="List view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isFiltered && (
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filteredTools.length}</span> of {tools.length} tools
          {" · "}
          {filteredTools.reduce((sum, t) => sum + t.available_quantity, 0)} available
        </p>
      )}

      {viewMode === "grid" ? (
        <ToolGrid
          tools={filteredTools}
          isLoading={isLoading}
          emptyText={globalLocationId ? `No tools at ${currentLocation?.name ?? "this location"}.` : "No tools found."}
          canDelete={canDelete}
          onView={setViewTool}
          onManageUnits={onManageUnits}
          onEditTool={onEditTool}
          onAdjustQuantity={onAdjustQuantity}
          onDeleteTool={onDeleteTool}
        />
      ) : (
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
                        <button
                          type="button"
                          onClick={() => setViewTool(tool)}
                          className="font-medium text-left hover:text-primary hover:underline focus-visible:outline-none focus-visible:underline"
                        >
                          {tool.name}
                        </button>
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
                        <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => onManageUnits?.(tool)}
                          title="Manage serialized units, QR labels, calibration & maintenance"
                        >
                          <Boxes className="h-3.5 w-3.5 mr-1.5" />
                          Units
                        </Button>
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
                            <DropdownMenuItem onClick={() => onManageUnits?.(tool)}>
                              <Boxes className="h-4 w-4 mr-2" />
                              Manage Units
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
                        </div>
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
      )}

      <ToolDetailsDialog
        tool={viewTool}
        open={!!viewTool}
        onOpenChange={(o) => { if (!o) setViewTool(null); }}
        onManageUnits={onManageUnits}
        onEdit={onEditTool}
        onAdjust={onAdjustQuantity}
      />
    </div>
  );
});

interface ToolGridProps {
  tools: WarehouseTool[];
  isLoading: boolean;
  emptyText: string;
  canDelete: boolean;
  onView?: (tool: WarehouseTool) => void;
  onManageUnits?: (tool: WarehouseTool) => void;
  onEditTool?: (tool: WarehouseTool) => void;
  onAdjustQuantity?: (tool: WarehouseTool) => void;
  onDeleteTool?: (tool: WarehouseTool) => void;
}

function ToolGrid({ tools, isLoading, emptyText, canDelete, onView, onManageUnits, onEditTool, onAdjustQuantity, onDeleteTool }: ToolGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card overflow-hidden">
            <div className="aspect-[4/3] bg-muted animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (tools.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card/50 py-16 text-center">
        <Wrench className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {tools.map((tool) => (
        <ToolGridCard
          key={tool.id}
          tool={tool}
          canDelete={canDelete}
          onView={onView}
          onManageUnits={onManageUnits}
          onEditTool={onEditTool}
          onAdjustQuantity={onAdjustQuantity}
          onDeleteTool={onDeleteTool}
        />
      ))}
    </div>
  );
}

function ToolGridCard({ tool, canDelete, onView, onManageUnits, onEditTool, onAdjustQuantity, onDeleteTool }: {
  tool: WarehouseTool;
  canDelete: boolean;
  onView?: (t: WarehouseTool) => void;
  onManageUnits?: (t: WarehouseTool) => void;
  onEditTool?: (t: WarehouseTool) => void;
  onAdjustQuantity?: (t: WarehouseTool) => void;
  onDeleteTool?: (t: WarehouseTool) => void;
}) {
  const available = Number(tool.available_quantity ?? 0);
  const hasIssued = Number(tool.issued_quantity ?? 0) > 0;
  const availTone = available > 0 ? "bg-success/15 text-success border-success/20" : "bg-destructive/15 text-destructive border-destructive/20";
  const [imgError, setImgError] = useState(false);
  const showImage = !!tool.image_url && !imgError;
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onView?.(tool)}
      onKeyDown={(e) => { if (e.key === "Enter") onView?.(tool); }}
      className="group text-left rounded-lg border bg-card overflow-hidden transition-all hover:border-primary/40 hover:shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {showImage ? (
          <img
            src={tool.image_url as string}
            alt={tool.name}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Wrench className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        <Badge variant="outline" className={`absolute top-2 right-2 ${availTone}`}>{available} avail</Badge>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <div className="font-mono text-[11px] text-muted-foreground truncate">{tool.tool_code}</div>
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 min-h-[2.5rem]" title={tool.name}>{tool.name}</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{tool.location?.name || "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t">
          <div className="flex items-center gap-1.5 text-xs pt-1">
            <Badge variant="outline" className="capitalize">{tool.condition}</Badge>
            <span className="text-muted-foreground">{tool.total_quantity} total</span>
          </div>
          <div className="flex items-center gap-1 pt-1" onClick={stop}>
            <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => onManageUnits?.(tool)} title="Manage units, QR, calibration & maintenance">
              <Boxes className="h-3.5 w-3.5 mr-1" /> Units
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditTool?.(tool)}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit Tool
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAdjustQuantity?.(tool)}>
                  <SlidersHorizontal className="h-4 w-4 mr-2" /> Adjust Quantity
                </DropdownMenuItem>
                {canDelete && !!onDeleteTool && !hasIssued && (
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDeleteTool(tool)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Tool
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
