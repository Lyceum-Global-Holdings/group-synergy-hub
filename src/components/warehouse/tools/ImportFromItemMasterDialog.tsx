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
import { AlertCircle, Crosshair, Info, Loader2, PackagePlus, RefreshCw, Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
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

/**
 * Phase 9.4 — whitespace + diacritic-tolerant normalizer.
 * Catalog data has been observed with leading/trailing spaces and double
 * internal spaces (e.g. "   Pvc  pipe-20MM"), so a naive `.includes()` over
 * raw strings silently hides legitimately-matching rows. Apply this on BOTH
 * sides of every comparison.
 */
const norm = (s: string | null | undefined): string =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

interface ImportFromItemMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Phase 9 — Catalog-based candidate row.
 * Source: warehouse_item_catalog (global Item Master, single source of truth).
 * Inventory snapshot is OPTIONAL and never filters visibility.
 */
interface CandidateItem {
  id: string;                       // catalog row id
  item_code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  unit_id: string | null;
  unit_cost: number | null;
  category_name: string | null;
  category_code: string | null;
  unit_abbreviation: string | null;
  // Optional inventory snapshot for the chosen target company/location
  inventory_item_id: string | null;
  current_stock: number | null;
  inventory_location_id: string | null;
}

/** Source scope: how broadly we look in the global catalog. */
type SourceScope = "suggested" | "tools" | "all";

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

  // ---------------------------------------------------------------------------
  // Source vs Destination
  //
  // Phase 9: source is ALWAYS the global Item Master catalog. Company &
  // location are *destinations* for the import — they never restrict which
  // catalog rows are visible.
  // ---------------------------------------------------------------------------

  // Phase 9.2 — Default to "all" because ~97% of the catalog is uncategorized
  // in production. A category-gated default silently hides the bulk of the
  // Item Master from the picker. The narrower scopes remain available as
  // opt-in filters for power users with a fully curated catalog.
  const [sourceScope, setSourceScope] = useState<SourceScope>("all");
  const [targetCompanyId, setTargetCompanyId] = useState<string>("");
  const [destinationLocationId, setDestinationLocationId] = useState<string>("none");

  // Default target company = currently selected company in the header.
  useEffect(() => {
    if (!open) return;
    if (selectedCompany?.id) {
      setTargetCompanyId(selectedCompany.id);
    } else if (accessibleCompanyIds.length > 0) {
      setTargetCompanyId(accessibleCompanyIds[0]);
    }
  }, [open, selectedCompany?.id, accessibleCompanyIds]);

  // Default destination location = global header location (if any).
  useEffect(() => {
    if (!open) return;
    setDestinationLocationId(globalLocationId ?? "none");
  }, [open, globalLocationId]);

  const categoryOptions = useMemo(
    () => buildToolCategoryOptions(allCategories),
    [allCategories],
  );
  // Phase 9: recursive descendant set so deep tool leaves are not silently dropped.
  const toolCategoryIds = useMemo(
    () => getToolCategoryIds(allCategories),
    [allCategories],
  );

  // Locations for the target company only (destination assignment).
  const { data: locationOptions = [] } = useEffectiveLocationsForCompanies(
    useMemo(() => (targetCompanyId ? [targetCompanyId] : []), [targetCompanyId]),
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

  // Phase 9.4 — "Find by exact code" finder state.
  const [finderCode, setFinderCode] = useState("");
  const [isFinding, setIsFinding] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Duplicate detection — prefer catalog_item_id (Phase 9 provenance), fall back
  // to (company_id, tool_code) for legacy tools created before the migration.
  // ---------------------------------------------------------------------------
  const importedCatalogIds = useMemo(() => {
    const s = new Set<string>();
    tools.forEach((t: any) => {
      if (
        t.catalog_item_id &&
        t.company_id &&
        t.company_id === targetCompanyId
      ) {
        s.add(String(t.catalog_item_id));
      }
    });
    return s;
  }, [tools, targetCompanyId]);

  const importedToolCodes = useMemo(() => {
    const s = new Set<string>();
    tools.forEach((t: any) => {
      if (t.tool_code && t.company_id === targetCompanyId) {
        s.add(t.tool_code.toLowerCase());
      }
    });
    return s;
  }, [tools, targetCompanyId]);

  // ---------------------------------------------------------------------------
  // Catalog query — single SECURITY INVOKER RPC, server-side join + filtering.
  // ---------------------------------------------------------------------------
  const effectiveCategoryIds = useMemo<string[] | null>(() => {
    if (sourceScope === "all") return null; // no category filter
    if (sourceScope === "tools" || sourceScope === "suggested") {
      return toolCategoryIds.length > 0 ? toolCategoryIds : null;
    }
    return null;
  }, [sourceScope, toolCategoryIds]);

  const { data: items = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: [
      "tool-catalog-candidates",
      sourceScope,
      targetCompanyId || "no-target",
      destinationLocationId,
      (effectiveCategoryIds ?? []).join(","),
    ],
    enabled: open,
    queryFn: async () => {
      // Phase 9.5 — Paginate the RPC in 1,000-row pages.
      // PostgREST caps RPC responses at the configured `db-max-rows` (1000 by
      // default). The catalog has ~15k active rows, so a single fetch silently
      // dropped >90% of the Item Master, which made the "Find by code" toast
      // appear successful while leaving the matched row invisible in the list.
      const PAGE = 1000;
      const all: any[] = [];
      let offset = 0;
      // Hard ceiling so we never hot-loop on a misbehaving RPC.
      while (offset < 50000) {
        const { data, error } = await supabase.rpc("get_tool_catalog_candidates", {
          p_search: null,
          p_category_ids: effectiveCategoryIds,
          p_include_all_categories: sourceScope === "all",
          p_target_company_id: targetCompanyId || null,
          p_target_location_id:
            destinationLocationId !== "none" ? destinationLocationId : null,
          p_limit: PAGE,
          p_offset: offset,
        });
        if (error) throw error;
        const page = data ?? [];
        all.push(...page);
        if (page.length < PAGE) break;
        offset += PAGE;
      }

      return all.map((row: any) => ({
        id: row.id,
        item_code: row.item_code,
        name: row.name,
        description: row.description,
        category_id: row.category_id,
        unit_id: row.unit_id,
        unit_cost: row.unit_cost,
        category_name:
          row.category_name ?? categoryNameById.get(row.category_id)?.name ?? null,
        category_code:
          row.category_code ?? categoryNameById.get(row.category_id)?.code ?? null,
        unit_abbreviation: row.unit_abbreviation ?? null,
        inventory_item_id: row.inventory_item_id ?? null,
        current_stock: row.current_stock ?? null,
        inventory_location_id: row.inventory_location_id ?? null,
      })) as CandidateItem[];
    },
  });

  // ---------------------------------------------------------------------------
  // Phase 9.2 — Lightweight scope counts so users can see at a glance how many
  // catalog rows each scope covers. Single SECURITY INVOKER RPC, ~1 round trip.
  // ---------------------------------------------------------------------------
  const { data: scopeCounts } = useQuery({
    queryKey: [
      "tool-catalog-candidate-counts",
      targetCompanyId || "no-target",
      toolCategoryIds.join(","),
    ],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_tool_catalog_candidate_counts",
        {
          p_target_company_id: targetCompanyId || null,
          p_tool_category_ids: toolCategoryIds.length > 0 ? toolCategoryIds : null,
        },
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        all: Number(row?.all_count ?? 0),
        tools: Number(row?.tools_count ?? 0),
        suggested: Number(row?.suggested_count ?? 0),
      };
    },
  });

  // Counts — total catalog rows fetched, already-imported, visible after dedup
  const totalRows = items.length;

  const alreadyImportedCount = useMemo(() => {
    let n = 0;
    for (const it of items) {
      if (importedCatalogIds.has(it.id)) {
        n += 1;
        continue;
      }
      if (it.item_code && importedToolCodes.has(it.item_code.toLowerCase())) {
        n += 1;
      }
    }
    return n;
  }, [items, importedCatalogIds, importedToolCodes]);

  const filteredItems = useMemo(() => {
    const q = norm(searchTerm);
    return items.filter((item) => {
      // Hide items already promoted into the target company (catalog_item_id first,
      // tool_code as legacy fallback).
      if (importedCatalogIds.has(item.id)) return false;
      if (item.item_code && importedToolCodes.has(item.item_code.toLowerCase()))
        return false;

      if (categoryFilter !== "all" && item.category_id !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      // Phase 9.4 — whitespace + diacritic-tolerant match across every
      // user-visible field. Without this, names like "   Pvc  pipe-20MM"
      // were silently unfindable.
      return (
        norm(item.item_code).includes(q) ||
        norm(item.name).includes(q) ||
        norm(item.description).includes(q) ||
        norm(item.category_name).includes(q) ||
        norm(item.category_code).includes(q)
      );
    });
  }, [items, searchTerm, categoryFilter, importedCatalogIds, importedToolCodes]);

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
    setFinderCode("");
    setHighlightedId(null);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
    setHighlightedId(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      resetState();
      queryClient.removeQueries({ queryKey: ["tool-catalog-candidates"] });
    }
    onOpenChange(next);
  };

  const handleImport = () => {
    const selected = filteredItems.filter((it) => selectedIds.has(it.id));
    if (selected.length === 0) return;
    if (!targetCompanyId) return;

    // SAP MM "material → equipment" promotion: catalog defines the candidate,
    // stock layer only seeds the suggested initial quantity.
    const payload: CreateWarehouseToolData[] = selected.map((item) => ({
      tool_code: item.item_code,
      name: item.name,
      description: item.description ?? undefined,
      category_id: item.category_id ?? undefined,
      unit_id: item.unit_id ?? undefined,
      location_id:
        destinationLocationId !== "none" ? destinationLocationId : undefined,
      total_quantity: getQty(item),
      condition: "good",
      unit_cost: item.unit_cost ?? undefined,
      company_id: targetCompanyId,
      catalog_item_id: item.id,
    }));

    createBulkTools(payload, {
      onSuccess: () => {
        onOpenChange(false);
        resetState();
        scheduleInvalidate(queryClient, ["tool-catalog-candidates"]);
        scheduleInvalidate(queryClient, ["warehouse-tools"]);
      },
    });
  };

  // Realtime: catalog inserts/updates can affect the candidate set; warehouse_items
  // changes only affect the inventory snapshot column. Both invalidate, debounced.
  // warehouse_tools subscription is owned by useWarehouseTools — do NOT duplicate.
  const onCatalogChange = useCallback(() => {
    if (!open) return;
    scheduleInvalidate(queryClient, ["tool-catalog-candidates"]);
  }, [open, queryClient]);
  useRealtimeChannel("warehouse_item_catalog", onCatalogChange);
  useRealtimeChannel("warehouse_items", onCatalogChange);

  const selectedCount = filteredItems.filter((it) => selectedIds.has(it.id)).length;
  const hasActiveFilters = searchTerm.trim().length > 0 || categoryFilter !== "all";

  // Row virtualization for large candidate sets (WAI-ARIA APG "Grid" pattern).
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

  // ---------------------------------------------------------------------------
  // Phase 9.4 — "Find by exact code" handler.
  //
  // Asks the database directly whether a code exists, whether it's active, and
  // whether it has already been promoted into the target company. Removes the
  // "is the item missing or am I just not finding it?" ambiguity for users
  // staring at a 14k-row catalog.
  // ---------------------------------------------------------------------------
  const runFinder = useCallback(async () => {
    const codeRaw = finderCode.trim();
    if (!codeRaw) return;
    setIsFinding(true);
    try {
      const { data, error } = await supabase.rpc("find_catalog_item_by_code", {
        p_code: codeRaw,
        p_target_company_id: targetCompanyId || null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;

      if (!row || !row.found) {
        toast({
          variant: "destructive",
          title: "Code not found",
          description: `No active or inactive Item Master row matches “${codeRaw}”.`,
        });
        return;
      }
      if (row.status !== "active") {
        toast({
          variant: "destructive",
          title: "Item is inactive",
          description: `“${row.item_code}” exists in the Item Master but its status is “${row.status}”. Re-activate it first.`,
        });
        return;
      }
      if (row.already_imported) {
        toast({
          title: "Already in Tool Master",
          description: `“${row.item_code}” has already been imported as “${row.tool_name ?? row.name}” for this company.`,
        });
        return;
      }

      // Force the item visible.
      //
      // CRITICAL: a server-confirmed lookup must OUTRANK any active narrowing
      // filter. The candidate query is keyed on `sourceScope` and
      // `effectiveCategoryIds`, so if the matched row's category is outside
      // the current scope (e.g. user is on "Tools" or "Suggested" and the
      // item is uncategorized), the row will *never* enter `items` no matter
      // what the search term is. Force scope back to "all" so the data
      // window contains the row, then clear the category dropdown, then sync
      // the search term so it's the only one standing.
      const wasNarrowed =
        sourceScope !== "all" || categoryFilter !== "all";
      setSourceScope("all");
      setCategoryFilter("all");
      setSearchTerm(row.item_code);
      setHighlightedId(row.catalog_id);

      // Phase 9.5 — Inject the matched row directly into every active
      // candidate cache. PostgREST's 1k-row response cap means a paginated
      // bulk fetch can still race the user, and on cold opens the matched
      // row may sit on a page that hasn't arrived yet. Writing it in
      // makes the "found" toast match what the list shows — always.
      const r: any = row;
      const injected: CandidateItem = {
        id: r.catalog_id,
        item_code: r.item_code,
        name: r.name,
        description: r.description ?? null,
        category_id: r.category_id ?? null,
        unit_id: r.unit_id ?? null,
        unit_cost: r.unit_cost ?? null,
        category_name:
          r.category_name ??
          (r.category_id ? categoryNameById.get(r.category_id)?.name ?? null : null),
        category_code:
          r.category_code ??
          (r.category_id ? categoryNameById.get(r.category_id)?.code ?? null : null),
        unit_abbreviation: r.unit_abbreviation ?? null,
        inventory_item_id: null,
        current_stock: null,
        inventory_location_id: null,
      };
      queryClient.setQueriesData<CandidateItem[]>(
        { queryKey: ["tool-catalog-candidates"] },
        (prev) => {
          const list = prev ?? [];
          if (list.some((r) => r?.id === injected.id)) return list;
          return [injected, ...list];
        },
      );

      // Wait for the candidate query to settle with the broadened scope
      // BEFORE asking the virtualizer to scroll, otherwise we're scrolling
      // an empty list. Poll the cache for the matched row id (≤2s) so this
      // works whether the data was already cached or had to refetch.
      const targetCatalogId: string = row.catalog_id;
      const scrollWhenReady = async () => {
        const deadline = Date.now() + 2000;
        while (Date.now() < deadline) {
          const cached = queryClient.getQueriesData<CandidateItem[]>({
            queryKey: ["tool-catalog-candidates"],
          });
          const present = cached.some(([, rows]) =>
            (rows ?? []).some((r) => r?.id === targetCatalogId),
          );
          if (present) {
            // Defer one frame so React has flushed `filteredItems` into the
            // virtualizer before we ask it to scroll.
            await new Promise((res) => requestAnimationFrame(() => res(null)));
            try {
              rowVirtualizer.scrollToIndex(0, { align: "center" });
            } catch {
              /* virtualizer not mounted yet — harmless */
            }
            return;
          }
          await new Promise((res) => setTimeout(res, 80));
        }
      };
      void scrollWhenReady();

      // Auto-clear highlight after 2.5s (slightly longer than the scroll wait).
      setTimeout(() => setHighlightedId(null), 2500);

      toast({
        title: "Item found",
        description: wasNarrowed
          ? `“${row.item_code}” — ${row.name}. Switched scope to “All item master” so it’s visible. Tick it and click Import.`
          : `“${row.item_code}” — ${row.name}. Tick it and click Import.`,
      });
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Lookup failed",
        description: e?.message ?? "Unknown error",
      });
    } finally {
      setIsFinding(false);
    }
  }, [
    finderCode,
    targetCompanyId,
    rowVirtualizer,
    sourceScope,
    categoryFilter,
    queryClient,
  ]);

  const inlineCategoryOptions = useMemo(() => {
    if (sourceScope !== "all") return categoryOptions;
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
        depth: 0 as const,
      }));
  }, [sourceScope, categoryOptions, items, categoryNameById]);

  const targetCompanyName =
    (targetCompanyId && companyNameById.get(targetCompanyId)) || "—";

  // Companies the user can actually pick as a target.
  const targetCompanyOptions = useMemo(() => {
    const ids = new Set<string>(accessibleCompanyIds);
    if (selectedCompany?.id) ids.add(selectedCompany.id);
    return Array.from(ids)
      .map((id) => ({ id, name: companyNameById.get(id) ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accessibleCompanyIds, selectedCompany?.id, companyNameById]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            Import from Item Master
          </DialogTitle>
          <DialogDescription>
            Showing every active Item Master entry by default so nothing is
            hidden behind catalog curation gaps. Use the scope tabs to narrow
            to curated tool categories. Company &amp; location below only
            control where tools are created.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 flex-1 overflow-hidden">
          {/* Source / Destination controls */}
          <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Source scope (Item Master)
              </span>
              <Tabs
                value={sourceScope}
                onValueChange={(v) => setSourceScope(v as SourceScope)}
              >
                <TabsList>
                  <TabsTrigger value="all" className="gap-2">
                    All item master
                    {scopeCounts && (
                      <span className="text-[10px] tabular-nums opacity-70">
                        {scopeCounts.all.toLocaleString()}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="tools" className="gap-2">
                    Tool categories
                    {scopeCounts && (
                      <span className="text-[10px] tabular-nums opacity-70">
                        {scopeCounts.tools.toLocaleString()}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="suggested" className="gap-2">
                    Suggested
                    {scopeCounts && (
                      <span className="text-[10px] tabular-nums opacity-70">
                        {scopeCounts.suggested.toLocaleString()}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex flex-col gap-1 min-w-[220px]">
              <span className="text-xs font-medium text-muted-foreground">
                Target company (destination)
              </span>
              <Select
                value={targetCompanyId || undefined}
                onValueChange={(v) => setTargetCompanyId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target company" />
                </SelectTrigger>
                <SelectContent>
                  {targetCompanyOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 min-w-[220px]">
              <span className="text-xs font-medium text-muted-foreground">
                Destination location (optional)
              </span>
              <Select
                value={destinationLocationId}
                onValueChange={setDestinationLocationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No default location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default location</SelectItem>
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
          {sourceScope === "all" && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Showing the full Item Master catalog — verify each item before
                promoting it to Tool Master.
              </AlertDescription>
            </Alert>
          )}
          {sourceScope !== "all" &&
            scopeCounts &&
            scopeCounts.all > 0 &&
            scopeCounts.tools < scopeCounts.all * 0.5 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Only{" "}
                  <strong>{scopeCounts.tools.toLocaleString()}</strong> of{" "}
                  <strong>{scopeCounts.all.toLocaleString()}</strong> catalog
                  items have a tool category assigned (
                  {Math.round(
                    ((scopeCounts.all - scopeCounts.tools) / scopeCounts.all) *
                      100,
                  )}
                  % uncategorized). Items like trowels, hand rakes etc. may
                  be missing from this scope — switch to{" "}
                  <strong>All item master</strong> to see every item.
                </AlertDescription>
              </Alert>
            )}
          {sourceScope !== "all" && toolCategoryIds.length === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Hand Tools / Power Tools categories are not set up. Switch to{" "}
                <strong>All item master</strong> above, or ask an administrator
                to add categories under codes <code>TOO-HND</code> /{" "}
                <code>TOO-PWR</code>.
              </AlertDescription>
            </Alert>
          )}

          {/* Phase 9.4 — direct code finder. Asks the DB whether a specific
              code exists, is active, and isn't already imported. Resolves the
              "is the item missing or am I just not finding it?" ambiguity. */}
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2">
            <Crosshair className="h-4 w-4 text-muted-foreground ml-1" />
            <span className="text-xs font-medium text-muted-foreground">
              Find by exact code
            </span>
            <Input
              placeholder="e.g. INV-CMP-CBL-0001"
              value={finderCode}
              onChange={(e) => setFinderCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runFinder();
                }
              }}
              className="h-8 w-[260px] font-mono text-sm"
              disabled={isFinding}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void runFinder()}
              disabled={isFinding || !finderCode.trim()}
            >
              {isFinding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Find & jump"
              )}
            </Button>
            <span className="text-[11px] text-muted-foreground">
              Confirms presence on the server in one click — no scrolling.
            </span>
          </div>

          {/* Search & inline category filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, name, description..."
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
                  {sourceScope === "all" ? "All categories" : "All tool categories"}
                </SelectItem>
                {inlineCategoryOptions.map(({ category, depth }: any) => (
                  <SelectItem key={category.id} value={category.id}>
                    <span
                      className={
                        depth === 0
                          ? "font-medium"
                          : depth === 1
                            ? "pl-4 text-muted-foreground"
                            : "pl-8 text-muted-foreground"
                      }
                    >
                      {depth === 1 ? "└ " : depth === 2 ? "  ↳ " : ""}
                      {category.code ? `[${category.code}] ` : ""}
                      {category.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Badge variant="secondary" title="Total catalog rows in this scope">
              {totalRows.toLocaleString()} total
            </Badge>
            <Badge variant="outline" title="Visible after removing already-imported">
              {filteredItems.length.toLocaleString()} visible
            </Badge>
            {alreadyImportedCount > 0 && (
              <Badge variant="secondary" title="Already imported into target company">
                {alreadyImportedCount.toLocaleString()} already imported
              </Badge>
            )}
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

          {!targetCompanyId && (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground text-center px-6">
              Pick a target company above to import tools into.
            </div>
          )}

          {targetCompanyId && isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading items…
              </span>
            </div>
          )}

          {targetCompanyId &&
            !isLoading &&
            !error &&
            items.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground text-center px-6">
                <span>No active items match this scope.</span>
                <span className="text-xs">
                  {sourceScope !== "all"
                    ? "Tool-category scope hides uncategorized items — switch to All item master."
                    : "Try refreshing, or check that the catalog has active items."}
                </span>
              </div>
            )}

          {targetCompanyId &&
            !isLoading &&
            !error &&
            items.length > 0 &&
            filteredItems.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground text-center px-6">
                <span>
                  {hasActiveFilters
                    ? "No items match the current filters."
                    : `All ${items.length.toLocaleString()} items in this scope are already imported into ${targetCompanyName}.`}
                </span>
                {/* Phase 9.4 — actionable diagnostic when search yields nothing.
                    If the term looks like a code, push the user straight at the
                    server-side finder rather than letting them wonder. */}
                {hasActiveFilters &&
                  searchTerm.trim().length > 0 &&
                  /^[A-Za-z]{2,}-|^[A-Za-z0-9]+-\d/.test(searchTerm.trim()) && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setFinderCode(searchTerm.trim());
                        void runFinder();
                      }}
                    >
                      <Crosshair className="h-3.5 w-3.5 mr-2" />
                      Look up “{searchTerm.trim()}” on the server
                    </Button>
                  )}
                {hasActiveFilters && categoryFilter !== "all" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCategoryFilter("all")}
                  >
                    Clear category filter
                  </Button>
                )}
                {sourceScope !== "all" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSourceScope("all")}
                  >
                    Switch to All item master
                  </Button>
                )}
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear all filters
                  </Button>
                )}
              </div>
            )}


          {targetCompanyId && !isLoading && filteredItems.length > 0 && (
            <div className="flex-1 min-h-[300px] border rounded-md overflow-hidden">
              <div
                ref={scrollParentRef}
                className="h-full w-full overflow-auto"
              >
                <Table
                  className="min-w-[1080px]"
                  aria-rowcount={filteredItems.length + 1}
                >
                  <colgroup>
                    <col style={{ width: 40 }} />
                    <col style={{ width: 140 }} />
                    <col style={{ width: 320 }} />
                    <col style={{ width: 220 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 120 }} />
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
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Stock @ target</TableHead>
                      <TableHead className="text-right">Initial Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  {shouldVirtualize ? (
                    (() => {
                      const virtualItems = rowVirtualizer.getVirtualItems();
                      const totalSize = rowVirtualizer.getTotalSize();
                      const paddingTop =
                        virtualItems.length > 0 ? virtualItems[0].start : 0;
                      const paddingBottom =
                        virtualItems.length > 0
                          ? totalSize - virtualItems[virtualItems.length - 1].end
                          : 0;
                      return (
                        <TableBody>
                          {paddingTop > 0 && (
                            <tr aria-hidden="true">
                              <td
                                colSpan={7}
                                style={{
                                  height: `${paddingTop}px`,
                                  padding: 0,
                                  border: 0,
                                }}
                              />
                            </tr>
                          )}
                          {virtualItems.map((virtualRow) => {
                            const item = filteredItems[virtualRow.index];
                            if (!item) return null;
                            const isSelected = selectedIds.has(item.id);
                            return (
                              <TableRow
                                key={item.id}
                                data-state={isSelected ? "selected" : undefined}
                                aria-rowindex={virtualRow.index + 2}
                                className={
                                  highlightedId === item.id
                                    ? "ring-2 ring-primary ring-offset-1 transition-shadow"
                                    : undefined
                                }
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleOne(item.id)}
                                    aria-label={`Select ${item.name}`}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-sm truncate">
                                  {item.item_code}
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium truncate">
                                    {item.name}
                                  </div>
                                  {item.description && (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {item.description}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {item.category_name ? (
                                    <Badge
                                      variant="outline"
                                      className="font-normal max-w-[200px] truncate"
                                    >
                                      {item.category_code
                                        ? `[${item.category_code}] `
                                        : ""}
                                      {item.category_name}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {item.unit_abbreviation ?? "—"}
                                </TableCell>
                                <TableCell className="text-right">
                                  {item.current_stock ?? 0}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={getQty(item)}
                                    onChange={(e) =>
                                      setQty(item.id, parseInt(e.target.value, 10))
                                    }
                                    disabled={!isSelected}
                                    className="h-8 text-right"
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {paddingBottom > 0 && (
                            <tr aria-hidden="true">
                              <td
                                colSpan={7}
                                style={{
                                  height: `${paddingBottom}px`,
                                  padding: 0,
                                  border: 0,
                                }}
                              />
                            </tr>
                          )}
                        </TableBody>
                      );
                    })()
                  ) : (
                    <TableBody>
                      {filteredItems.map((item, idx) => {
                        const isSelected = selectedIds.has(item.id);
                        return (
                          <TableRow
                            key={item.id}
                            data-state={isSelected ? "selected" : undefined}
                            aria-rowindex={idx + 2}
                            className={
                              highlightedId === item.id
                                ? "ring-2 ring-primary ring-offset-1 transition-shadow"
                                : undefined
                            }
                          >
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleOne(item.id)}
                                aria-label={`Select ${item.name}`}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm truncate">
                              {item.item_code}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium truncate">
                                {item.name}
                              </div>
                              {item.description && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {item.description}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.category_name ? (
                                <Badge
                                  variant="outline"
                                  className="font-normal max-w-[200px] truncate"
                                >
                                  {item.category_code
                                    ? `[${item.category_code}] `
                                    : ""}
                                  {item.category_name}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
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
                                onChange={(e) =>
                                  setQty(item.id, parseInt(e.target.value, 10))
                                }
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
          <div className="mr-auto text-xs text-muted-foreground">
            Importing into <strong>{targetCompanyName}</strong>
            {destinationLocationId !== "none" && (
              <>
                {" · "}
                <strong>
                  {locationOptions.find(
                    (l: any) => l.id === destinationLocationId,
                  )?.name ?? "selected location"}
                </strong>
              </>
            )}
          </div>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedCount === 0 || isCreatingBulk || !targetCompanyId}
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
