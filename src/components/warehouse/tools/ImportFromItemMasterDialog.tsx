import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Info, Loader2, PackagePlus, RefreshCw, Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeChannel } from "@/hooks/useRealtimeBus";
import { scheduleInvalidate } from "@/lib/queryInvalidation";
import { useCompany } from "@/contexts/CompanyContext";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useWarehouseTools } from "@/hooks/useWarehouseTools";
import { useAccessibleCompanyIds } from "@/hooks/construction/useAccessibleCompanyIds";
import { useEffectiveLocationsForCompanies } from "@/hooks/useWarehouseLocations";
import {
  buildToolCategoryOptions,
  getToolCategoryIds,
} from "@/features/tools/lib/toolCategories";
import type { CreateWarehouseToolData } from "@/types/toolManagement";

interface ImportFromItemMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CandidateItem {
  id: string;
  item_code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  unit_id: string | null;
  current_stock: number | null;
  unit_cost: number | null;
  company_id: string | null;
  location_id: string | null;
  category_name: string | null;
  category_code: string | null;
  unit_abbreviation: string | null;
}

type CategoryScope = "tools" | "all";
type CompanyScope = "current" | "all";

export function ImportFromItemMasterDialog({
  open,
  onOpenChange,
}: ImportFromItemMasterDialogProps) {
  const { selectedCompany, companies } = useCompany();
  const { globalLocationId } = useLocationFilter();
  const { allCategories } = useItemCategories(selectedCompany?.id);
  const { tools, createBulkTools, isCreatingBulk } = useWarehouseTools();
  const { data: accessibleCompanyIds = [] } = useAccessibleCompanyIds();
  const queryClient = useQueryClient();

  // Two-axis scope (SAP MM "promotion" defaults to current plant + tool categories).
  const [categoryScope, setCategoryScope] = useState<CategoryScope>("tools");
  const [companyScope, setCompanyScope] = useState<CompanyScope>("current");
  const [locationId, setLocationId] = useState<string>("any");

  // SAP EWM "default storage location": prefill the destination filter with
  // the global header location so promoted tools land in the active site.
  useEffect(() => {
    if (!open) return;
    if (globalLocationId) setLocationId(globalLocationId);
  }, [open, globalLocationId]);

  const categoryOptions = useMemo(
    () => buildToolCategoryOptions(allCategories),
    [allCategories],
  );
  const toolCategoryIds = useMemo(
    () => getToolCategoryIds(allCategories),
    [allCategories],
  );

  const effectiveCompanyIds = useMemo(() => {
    if (companyScope === "current") {
      return selectedCompany?.id ? [selectedCompany.id] : [];
    }
    return accessibleCompanyIds;
  }, [companyScope, selectedCompany?.id, accessibleCompanyIds]);

  // Locations for the selected company-scope (union across companies for "all").
  const { data: locationOptions = [] } = useEffectiveLocationsForCompanies(
    effectiveCompanyIds,
  );

  const companyNameById = useMemo(() => {
    const m = new Map<string, string>();
    (companies ?? []).forEach((c) => c?.id && m.set(c.id, c.name));
    return m;
  }, [companies]);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, { name: string; code: string | null }>();
    (allCategories ?? []).forEach((c) =>
      m.set(c.id, { name: c.name, code: c.code ?? null }),
    );
    return m;
  }, [allCategories]);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const existingToolKeys = useMemo(
    () =>
      new Set(
        tools
          .map((t) =>
            t.tool_code && t.company_id
              ? `${t.company_id}::${t.tool_code.toLowerCase()}`
              : null,
          )
          .filter(Boolean) as string[],
      ),
    [tools],
  );

  const { data: items = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: [
      "warehouse-items-tool-candidates",
      companyScope,
      categoryScope,
      locationId,
      effectiveCompanyIds.slice().sort().join(","),
      toolCategoryIds.join(","),
    ],
    enabled:
      open &&
      effectiveCompanyIds.length > 0 &&
      (categoryScope === "all" || toolCategoryIds.length > 0),
    queryFn: async () => {
      // warehouse_items canonical column is `name` (SAP MM Material Master).
      // Batched fetch in 1000-row pages to bypass PostgREST default limit
      // (per project memory: warehouse-data-batching-limit).
      const PAGE_SIZE = 1000;
      const all: any[] = [];
      let from = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        let query = supabase
          .from("warehouse_items")
          .select(
            `
            id,
            item_code,
            name,
            description,
            category_id,
            unit_id,
            current_stock,
            unit_cost,
            company_id,
            location_id,
            category:item_categories!category_id(name, code),
            unit:item_units!unit_id(abbreviation)
          `,
          )
          .in("company_id", effectiveCompanyIds)
          .order("name", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (categoryScope === "tools") {
          query = query.in("category_id", toolCategoryIds);
        }
        if (locationId !== "any") {
          query = query.eq("location_id", locationId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const page = data ?? [];
        all.push(...page);
        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      return all.map((row: any) => {
        const cat = categoryNameById.get(row.category_id);
        return {
          id: row.id,
          item_code: row.item_code,
          name: row.name,
          description: row.description,
          category_id: row.category_id,
          unit_id: row.unit_id,
          current_stock: row.current_stock,
          unit_cost: row.unit_cost,
          company_id: row.company_id,
          location_id: row.location_id,
          category_name: row.category?.name ?? cat?.name ?? null,
          category_code: row.category?.code ?? cat?.code ?? null,
          unit_abbreviation: row.unit?.abbreviation ?? null,
        } as CandidateItem;
      });
    },
  });

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      // Tenant-scoped duplicate check: same code in same company => already promoted.
      const dupKey =
        item.item_code && item.company_id
          ? `${item.company_id}::${item.item_code.toLowerCase()}`
          : null;
      if (dupKey && existingToolKeys.has(dupKey)) return false;

      if (categoryFilter !== "all" && item.category_id !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.item_code?.toLowerCase().includes(q) ||
        item.name?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.category_name?.toLowerCase().includes(q) ||
        companyNameById.get(item.company_id ?? "")?.toLowerCase().includes(q)
      );
    });
  }, [items, searchTerm, categoryFilter, existingToolKeys, companyNameById]);

  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((it) => selectedIds.has(it.id));

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredItems.forEach((it) => next.delete(it.id));
      } else {
        filteredItems.forEach((it) => next.add(it.id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getQty = (item: CandidateItem) =>
    quantities[item.id] ?? Math.max(0, Math.floor(item.current_stock ?? 0));

  const setQty = (id: string, value: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, Math.floor(value || 0)) }));
  };

  const resetState = () => {
    setSearchTerm("");
    setCategoryFilter("all");
    setSelectedIds(new Set());
    setQuantities({});
  };

  const clearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      resetState();
      queryClient.removeQueries({ queryKey: ["warehouse-items-tool-candidates"] });
    }
    onOpenChange(next);
  };

  const handleImport = () => {
    const selected = filteredItems.filter((it) => selectedIds.has(it.id));
    if (selected.length === 0) return;

    // ISO 27001 A.9.4 / multi-tenant integrity: tools must land in the SOURCE
    // item's company, not the header-selected company, when scope is widened.
    const payload: CreateWarehouseToolData[] = selected.map((item) => ({
      tool_code: item.item_code,
      name: item.name,
      description: item.description ?? undefined,
      category_id: item.category_id ?? undefined,
      unit_id: item.unit_id ?? undefined,
      // Auto-assign destination location from global filter when set; falls
      // back to the source item's location_id otherwise.
      location_id: globalLocationId ?? item.location_id ?? undefined,
      total_quantity: getQty(item),
      condition: "good",
      unit_cost: item.unit_cost ?? undefined,
      company_id: item.company_id ?? selectedCompany?.id,
    }));

    createBulkTools(payload, {
      onSuccess: () => {
        // Refresh both candidate list (promoted rows disappear) and the
        // tools list (new keys reflect in existingToolKeys de-dup).
        queryClient.invalidateQueries({ queryKey: ["warehouse-items-tool-candidates"] });
        queryClient.invalidateQueries({ queryKey: ["warehouse-tools"] });
        onOpenChange(false);
        resetState();
      },
    });
  };

  // Realtime: keep the candidate list fresh when items are added/edited/deleted
  // in the source warehouse_items table, via the shared realtime bus.
  // Debounced + scoped to avoid refetch storms during bulk imports.
  const onItemsChange = useCallback(() => {
    if (!open || effectiveCompanyIds.length === 0) return;
    scheduleInvalidate(queryClient, ["warehouse-items-tool-candidates"]);
  }, [open, effectiveCompanyIds, queryClient]);
  const onToolsChange = useCallback(() => {
    if (!open) return;
    // New tools elsewhere → existingToolKeys updates → candidate de-dup refreshes.
    scheduleInvalidate(queryClient, ["warehouse-tools"]);
  }, [open, queryClient]);
  useRealtimeChannel("warehouse_items", onItemsChange);
  useRealtimeChannel("warehouse_tools", onToolsChange);

  const selectedCount = filteredItems.filter((it) => selectedIds.has(it.id)).length;
  const hasActiveFilters = searchTerm.trim().length > 0 || categoryFilter !== "all";

  // Row virtualization for large candidate sets (WAI-ARIA APG "Grid" pattern).
  // Below threshold we render normally to keep DOM simple.
  const VIRTUAL_THRESHOLD = 200;
  const ROW_HEIGHT = 56;
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = filteredItems.length > VIRTUAL_THRESHOLD;
  const rowVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  // Categories visible in the inline category picker depend on scope.
  const inlineCategoryOptions = useMemo(() => {
    if (categoryScope === "tools") return categoryOptions;
    // For "all" scope, list every category that actually appears in the result set.
    const seen = new Set<string>();
    items.forEach((it) => {
      if (it.category_id) seen.add(it.category_id);
    });
    return Array.from(seen)
      .map((id) => categoryNameById.get(id) && { id, ...categoryNameById.get(id)! })
      .filter(Boolean)
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
      .map((c: any) => ({
        category: { id: c.id, name: c.name, code: c.code } as any,
        depth: 0 as 0,
      }));
  }, [categoryScope, categoryOptions, items, categoryNameById]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            Import from Item Master
          </DialogTitle>
          <DialogDescription>
            Promote existing Item Master items into Tool Master. Defaults to the
            current company's tool categories; widen the scope below to see the
            full catalog or items from other companies you can access.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 flex-1 overflow-hidden">
          {/* Scope controls */}
          <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Category scope
              </span>
              <Tabs
                value={categoryScope}
                onValueChange={(v) => setCategoryScope(v as CategoryScope)}
              >
                <TabsList>
                  <TabsTrigger value="tools">Tool categories</TabsTrigger>
                  <TabsTrigger value="all">All categories</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Company scope
              </span>
              <Tabs
                value={companyScope}
                onValueChange={(v) => setCompanyScope(v as CompanyScope)}
              >
                <TabsList>
                  <TabsTrigger value="current" disabled={!selectedCompany?.id}>
                    Current company
                  </TabsTrigger>
                  <TabsTrigger
                    value="all"
                    disabled={accessibleCompanyIds.length === 0}
                  >
                    All my companies
                    {accessibleCompanyIds.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {accessibleCompanyIds.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex flex-col gap-1 min-w-[220px]">
              <span className="text-xs font-medium text-muted-foreground">
                Location / Sub-location
              </span>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Any location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any location</SelectItem>
                  {locationOptions.map((loc: any) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.parent_id ? `↳ ${loc.name}` : loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Safety-rail banners */}
          {categoryScope === "all" && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Showing items beyond Tool categories — verify each before promoting
                to Tool Master.
              </AlertDescription>
            </Alert>
          )}
          {companyScope === "all" && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Cross-company view active — tools will be created in each item's
                source company, not the company in the header.
              </AlertDescription>
            </Alert>
          )}
          {globalLocationId ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Auto-filled from current location filter — promoted tools will
                land in{" "}
                <strong>
                  {locationOptions.find((l: any) => l.id === globalLocationId)
                    ?.name ?? "the selected location"}
                </strong>
                . Change the Location dropdown above to override.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Pick a global location in the header to auto-assign all imports
                to a single site.
              </AlertDescription>
            </Alert>
          )}

          {/* Search & inline category filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, name, description, company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {categoryScope === "tools" ? "All tool categories" : "All categories"}
                </SelectItem>
                {inlineCategoryOptions.map(({ category, depth }: any) => (
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

            <Badge variant="secondary">
              {filteredItems.length} candidate{filteredItems.length === 1 ? "" : "s"}
            </Badge>
            {selectedCount > 0 && (
              <Badge variant="default">{selectedCount} selected</Badge>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh candidates"
              title="Refresh candidates"
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load candidate items: {(error as Error).message}
              </AlertDescription>
            </Alert>
          )}

          {effectiveCompanyIds.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground text-center px-6">
              {companyScope === "current"
                ? "Select a company in the header, or switch the company scope to All my companies."
                : "You don't have access to any companies yet."}
            </div>
          )}

          {effectiveCompanyIds.length > 0 && isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading items…</span>
            </div>
          )}

          {effectiveCompanyIds.length > 0 &&
            !isLoading &&
            !error &&
            categoryScope === "tools" &&
            toolCategoryIds.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground text-center px-6">
                Hand Tools / Power Tools categories are not set up. Switch to{" "}
                <strong className="mx-1">All categories</strong> above, or ask an
                administrator to add categories under codes{" "}
                <code className="font-mono">TOO-HND</code> /{" "}
                <code className="font-mono">TOO-PWR</code>.
              </div>
            )}

          {effectiveCompanyIds.length > 0 &&
            !isLoading &&
            !error &&
            !(categoryScope === "tools" && toolCategoryIds.length === 0) &&
            items.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground text-center px-6">
                <span>No items match this scope.</span>
                <span className="text-xs">
                  Try widening category, company, or clearing the location filter.
                </span>
              </div>
            )}

          {effectiveCompanyIds.length > 0 &&
            !isLoading &&
            !error &&
            items.length > 0 &&
            filteredItems.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground text-center px-6">
                <span>No items match the current filters.</span>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            )}

          {effectiveCompanyIds.length > 0 && !isLoading && filteredItems.length > 0 && (
            <div className="flex-1 min-h-[300px] border rounded-md overflow-hidden">
              <div
                ref={scrollParentRef}
                className="h-full w-full overflow-auto"
              >
                <Table
                  className="min-w-[1180px]"
                  aria-rowcount={filteredItems.length + 1}
                >
                  <colgroup>
                    <col style={{ width: 40 }} />
                    <col style={{ width: 140 }} />
                    <col style={{ width: 280 }} />
                    <col style={{ width: 200 }} />
                    <col style={{ width: 200 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 130 }} />
                  </colgroup>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow aria-rowindex={1}>
                      <TableHead>
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={toggleAllVisible}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Company (target)</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Current Stock</TableHead>
                      <TableHead className="text-right">Initial Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  {shouldVirtualize ? (
                    (() => {
                      const virtualItems = rowVirtualizer.getVirtualItems();
                      const totalSize = rowVirtualizer.getTotalSize();
                      const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
                      const paddingBottom =
                        virtualItems.length > 0
                          ? totalSize - virtualItems[virtualItems.length - 1].end
                          : 0;
                      return (
                        <TableBody>
                          {paddingTop > 0 && (
                            <tr aria-hidden="true">
                              <td colSpan={8} style={{ height: `${paddingTop}px`, padding: 0, border: 0 }} />
                            </tr>
                          )}
                          {virtualItems.map((virtualRow) => {
                            const item = filteredItems[virtualRow.index];
                            if (!item) return null;
                            const isSelected = selectedIds.has(item.id);
                            const companyName =
                              (item.company_id && companyNameById.get(item.company_id)) ||
                              "—";
                            return (
                              <TableRow
                                key={item.id}
                                data-state={isSelected ? "selected" : undefined}
                                aria-rowindex={virtualRow.index + 2}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleOne(item.id)}
                                    aria-label={`Select ${item.name}`}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-sm truncate">{item.item_code}</TableCell>
                                <TableCell>
                                  <div className="font-medium truncate">{item.name}</div>
                                  {item.description && (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {item.description}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {item.category_name ? (
                                    <Badge variant="outline" className="font-normal max-w-[180px] truncate">
                                      {item.category_code ? `[${item.category_code}] ` : ""}
                                      {item.category_name}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="font-normal max-w-[180px] truncate">
                                    {companyName}
                                  </Badge>
                                </TableCell>
                                <TableCell>{item.unit_abbreviation ?? "—"}</TableCell>
                                <TableCell className="text-right">
                                  {item.current_stock ?? 0}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={getQty(item)}
                                    onChange={(e) => setQty(item.id, parseInt(e.target.value, 10))}
                                    disabled={!isSelected}
                                    className="h-8 text-right"
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {paddingBottom > 0 && (
                            <tr aria-hidden="true">
                              <td colSpan={8} style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }} />
                            </tr>
                          )}
                        </TableBody>
                      );
                    })()
                  ) : (
                    <TableBody>
                      {filteredItems.map((item, idx) => {
                        const isSelected = selectedIds.has(item.id);
                        const companyName =
                          (item.company_id && companyNameById.get(item.company_id)) ||
                          "—";
                        return (
                          <TableRow
                            key={item.id}
                            data-state={isSelected ? "selected" : undefined}
                            aria-rowindex={idx + 2}
                          >
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleOne(item.id)}
                                aria-label={`Select ${item.name}`}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm truncate">{item.item_code}</TableCell>
                            <TableCell>
                              <div className="font-medium truncate">{item.name}</div>
                              {item.description && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {item.description}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.category_name ? (
                                <Badge variant="outline" className="font-normal max-w-[180px] truncate">
                                  {item.category_code ? `[${item.category_code}] ` : ""}
                                  {item.category_name}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-normal max-w-[180px] truncate">
                                {companyName}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.unit_abbreviation ?? "—"}</TableCell>
                            <TableCell className="text-right">
                              {item.current_stock ?? 0}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                value={getQty(item)}
                                onChange={(e) => setQty(item.id, parseInt(e.target.value, 10))}
                                disabled={!isSelected}
                                className="h-8 text-right"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  )}
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedCount === 0 || isCreatingBulk}
          >
            {isCreatingBulk ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <PackagePlus className="h-4 w-4 mr-2" />
                Import {selectedCount > 0 ? selectedCount : ""} as Tools
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
