import { useState, useMemo } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { AlertCircle, Loader2, PackagePlus, Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useItemCategories } from "@/hooks/useItemCategories";
import { useWarehouseTools } from "@/hooks/useWarehouseTools";
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
  category_name: string | null;
  category_code: string | null;
  unit_abbreviation: string | null;
}

export function ImportFromItemMasterDialog({
  open,
  onOpenChange,
}: ImportFromItemMasterDialogProps) {
  const { selectedCompany } = useCompany();
  const { allCategories } = useItemCategories(selectedCompany?.id);
  const { tools, createBulkTools, isCreatingBulk } = useWarehouseTools();
  const queryClient = useQueryClient();

  const categoryOptions = useMemo(
    () => buildToolCategoryOptions(allCategories),
    [allCategories],
  );
  const toolCategoryIds = useMemo(
    () => getToolCategoryIds(allCategories),
    [allCategories],
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const existingToolCodes = useMemo(
    () =>
      new Set(
        tools
          .filter((t) => !selectedCompany?.id || t.company_id === selectedCompany.id)
          .map((t) => t.tool_code?.toLowerCase())
          .filter(Boolean) as string[],
      ),
    [tools, selectedCompany?.id],
  );

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: [
      "warehouse-items-tool-candidates",
      selectedCompany?.id,
      toolCategoryIds.join(","),
    ],
    enabled: open && !!selectedCompany?.id && toolCategoryIds.length > 0,
    queryFn: async () => {
      // NOTE: warehouse_items canonical name column is `name` (per SAP MM Material Master).
      // The Tools subtree includes root + L1 children via getToolCategoryIds; L2 codes
      // (e.g. TOO-HND-HAM) are children of L1 and therefore swept in via category_id IN (...).
      const { data, error } = await supabase
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
          category:item_categories!category_id(name, code),
          unit:item_units!unit_id(abbreviation)
        `,
        )
        .eq("company_id", selectedCompany!.id)
        .in("category_id", toolCategoryIds)
        .order("name", { ascending: true })
        .limit(2000);

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        item_code: row.item_code,
        name: row.name,
        description: row.description,
        category_id: row.category_id,
        unit_id: row.unit_id,
        current_stock: row.current_stock,
        unit_cost: row.unit_cost,
        category_name: row.category?.name ?? null,
        category_code: row.category?.code ?? null,
        unit_abbreviation: row.unit?.abbreviation ?? null,
      })) as CandidateItem[];
    },
  });

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      if (item.item_code && existingToolCodes.has(item.item_code.toLowerCase())) {
        return false;
      }
      if (categoryFilter !== "all" && item.category_id !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.item_code?.toLowerCase().includes(q) ||
        item.name?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.category_name?.toLowerCase().includes(q)
      );
    });
  }, [items, searchTerm, categoryFilter, existingToolCodes]);

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

    const payload: CreateWarehouseToolData[] = selected.map((item) => ({
      tool_code: item.item_code,
      name: item.name,
      description: item.description ?? undefined,
      category_id: item.category_id ?? undefined,
      unit_id: item.unit_id ?? undefined,
      total_quantity: getQty(item),
      condition: "good",
      unit_cost: item.unit_cost ?? undefined,
      company_id: selectedCompany?.id,
    }));

    createBulkTools(payload, {
      onSuccess: () => {
        onOpenChange(false);
        resetState();
      },
    });
  };

  const selectedCount = filteredItems.filter((it) => selectedIds.has(it.id)).length;
  const hasActiveFilters = searchTerm.trim().length > 0 || categoryFilter !== "all";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            Import from Item Master
          </DialogTitle>
          <DialogDescription>
            Promote existing Item Master items categorized as <strong>Hand Tools</strong> or{" "}
            <strong>Power Tools</strong> (or their sub-categories) into Tool Master. Items
            already promoted are hidden.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 flex-1 overflow-hidden">
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
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tools Categories</SelectItem>
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

            <Badge variant="secondary">
              {filteredItems.length} candidate{filteredItems.length === 1 ? "" : "s"}
            </Badge>
            {selectedCount > 0 && (
              <Badge variant="default">{selectedCount} selected</Badge>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load candidate items: {(error as Error).message}
              </AlertDescription>
            </Alert>
          )}

          {!selectedCompany?.id && (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select a company to view candidate items.
            </div>
          )}

          {selectedCompany?.id && isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading items…</span>
            </div>
          )}

          {selectedCompany?.id && !isLoading && !error && toolCategoryIds.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground text-center px-6">
              Hand Tools / Power Tools categories are not set up. Ask an administrator
              to add categories under codes <code className="font-mono">TOO-HND</code> or{" "}
              <code className="font-mono">TOO-PWR</code>.
            </div>
          )}

          {selectedCompany?.id &&
            !isLoading &&
            !error &&
            toolCategoryIds.length > 0 &&
            items.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground text-center px-6">
                No Item Master items in <strong>{selectedCompany.name}</strong> are
                categorized under Hand Tools or Power Tools. Switch company in the
                header, or add items under those categories first.
              </div>
            )}

          {selectedCompany?.id &&
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

          {selectedCompany?.id && !isLoading && filteredItems.length > 0 && (
            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-10">
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
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="w-32 text-right">Initial Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const isSelected = selectedIds.has(item.id);
                    return (
                      <TableRow key={item.id} data-state={isSelected ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleOne(item.id)}
                            aria-label={`Select ${item.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.item_code}</TableCell>
                        <TableCell>
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                              {item.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.category_name ? (
                            <Badge variant="outline" className="font-normal">
                              {item.category_code ? `[${item.category_code}] ` : ""}
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
                            onChange={(e) => setQty(item.id, parseInt(e.target.value, 10))}
                            disabled={!isSelected}
                            className="h-8 text-right"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
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
