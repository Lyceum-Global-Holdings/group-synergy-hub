import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VirtualTable, type DataTableColumn } from "@/components/shared/VirtualTable";
import {
  Download, Pencil, PackageMinus, Scissors, Search, Upload, Plus, X,
  ChevronRight, ChevronDown, Layers, List as ListIcon,
} from "lucide-react";
import { usePartialPieces, usePartialPieceItems } from "@/hooks/warehouse/usePartialPieces";
import { PIECE_STATUS_OPTIONS, type PartialPieceRow, type PartialPieceStatus } from "@/types/partialPiece";
import { AddPartialPieceDialog } from "@/components/warehouse/partial-qty/AddPartialPieceDialog";
import { EditPartialPieceDialog } from "@/components/warehouse/partial-qty/EditPartialPieceDialog";
import { ConsumePartialPieceDialog } from "@/components/warehouse/partial-qty/ConsumePartialPieceDialog";
import { SplitPartialPieceDialog } from "@/components/warehouse/partial-qty/SplitPartialPieceDialog";
import { ImportPartialPiecesDialog } from "@/components/warehouse/partial-qty/ImportPartialPiecesDialog";
import { useLocationFilter } from "@/contexts/LocationFilterContext";
import { useWarehouseLocations } from "@/hooks/useWarehouseLocations";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<PartialPieceStatus, "default" | "secondary" | "outline" | "destructive"> = {
  available: "default",
  reserved: "secondary",
  consumed: "outline",
  scrapped: "destructive",
};

const VIEW_KEY = "partial-pieces-view-mode";

type ViewMode = "grouped" | "flat";

interface GroupRow {
  rowType: "group";
  id: string;
  parent_item_id: string;
  parent_item_code: string;
  parent_item_name: string;
  base_uom: string | null;
  piece_count: number;
  totals_by_uom: Record<string, number>;
  status_counts: Record<PartialPieceStatus, number>;
  location_count: number;
  oldest_age_days: number;
  pieces: PartialPieceRow[];
}

interface ChildRow extends PartialPieceRow {
  rowType: "child";
}

type AnyRow = GroupRow | ChildRow;

function fmtNum(n: number): string {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function buildGroups(rows: PartialPieceRow[]): GroupRow[] {
  const map = new Map<string, GroupRow>();
  for (const r of rows) {
    let g = map.get(r.parent_item_id);
    if (!g) {
      g = {
        rowType: "group",
        id: `group:${r.parent_item_id}`,
        parent_item_id: r.parent_item_id,
        parent_item_code: r.parent_item_code,
        parent_item_name: r.parent_item_name,
        base_uom: r.base_uom,
        piece_count: 0,
        totals_by_uom: {},
        status_counts: { available: 0, reserved: 0, consumed: 0, scrapped: 0 },
        location_count: 0,
        oldest_age_days: 0,
        pieces: [],
      };
      map.set(r.parent_item_id, g);
    }
    g.pieces.push(r);
    g.piece_count += 1;
    const uom = (r.size_uom || "").trim() || "—";
    g.totals_by_uom[uom] = (g.totals_by_uom[uom] || 0) + Number(r.size_value || 0);
    g.status_counts[r.status] = (g.status_counts[r.status] || 0) + 1;
    if (r.age_days > g.oldest_age_days) g.oldest_age_days = r.age_days;
  }
  for (const g of map.values()) {
    g.location_count = new Set(g.pieces.map(p => p.location_id)).size;
    // Stable order: oldest piece first within group (FIFO surfacing).
    g.pieces.sort((a, b) => b.age_days - a.age_days);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.parent_item_code.localeCompare(b.parent_item_code),
  );
}

function flattenGroups(groups: GroupRow[], expanded: Set<string>): AnyRow[] {
  const out: AnyRow[] = [];
  for (const g of groups) {
    out.push(g);
    if (expanded.has(g.parent_item_id)) {
      for (const p of g.pieces) out.push({ ...p, rowType: "child" });
    }
  }
  return out;
}

function toCsv(rows: PartialPieceRow[]): string {
  const head = ["piece_code","parent_item_code","parent_item_name","size_value","size_uom","location","bin","status","source_ref","batch_number","unit_cost","label","age_days","created_at"];
  const body = rows.map(r => [
    r.piece_code, r.parent_item_code, r.parent_item_name,
    r.size_value, r.size_uom, r.location_name, r.bin_code ?? "",
    r.status, r.source_ref ?? "", r.batch_number ?? "",
    r.unit_cost ?? "", r.label ?? "", r.age_days, r.created_at,
  ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  return [head.join(","), ...body].join("\n");
}

function summaryCsv(groups: GroupRow[]): string {
  const head = ["item_code","item_name","piece_count","totals","available","reserved","consumed","scrapped","locations","oldest_age_days"];
  const body = groups.map(g => {
    const totals = Object.entries(g.totals_by_uom).map(([u, v]) => `${fmtNum(v)} ${u}`).join("; ");
    return [
      g.parent_item_code, g.parent_item_name, g.piece_count, totals,
      g.status_counts.available, g.status_counts.reserved,
      g.status_counts.consumed, g.status_counts.scrapped,
      g.location_count, g.oldest_age_days,
    ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
  });
  return [head.join(","), ...body].join("\n");
}

function downloadCsv(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  a.click(); URL.revokeObjectURL(url);
}

export default function PartialQuantities() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("available");
  const [parentItemId, setParentItemId] = useState<string>("all");
  const { globalLocationId, setGlobalLocationId } = useLocationFilter();
  const { locations } = useWarehouseLocations();
  const activeLocationName = useMemo(() => {
    if (!globalLocationId) return null;
    const l = (locations as Array<{ id: string; name?: string; location_code?: string }>).find(x => x.id === globalLocationId);
    return l?.name || l?.location_code || null;
  }, [globalLocationId, locations]);
  const { data: rows = [], isLoading } = usePartialPieces({
    search,
    status,
    parentItemId: parentItemId === "all" ? null : parentItemId,
  });
  const { data: itemOptions = [] } = usePartialPieceItems();

  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grouped";
    return (localStorage.getItem(VIEW_KEY) as ViewMode) || "grouped";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const [addOpen, setAddOpen] = useState(false);
  const [addDefaultItemId, setAddDefaultItemId] = useState<string | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);
  const [editPiece, setEditPiece] = useState<PartialPieceRow | null>(null);
  const [consumePiece, setConsumePiece] = useState<PartialPieceRow | null>(null);
  const [splitPiece, setSplitPiece] = useState<PartialPieceRow | null>(null);

  const groups = useMemo(() => buildGroups(rows), [rows]);
  const tableRows: AnyRow[] = useMemo(() => {
    if (view === "flat") return rows.map(r => ({ ...r, rowType: "child" as const }));
    return flattenGroups(groups, expanded);
  }, [view, rows, groups, expanded]);

  const expandAll = () => setExpanded(new Set(groups.map(g => g.parent_item_id)));
  const collapseAll = () => setExpanded(new Set());

  const openAddForGroup = (parentId?: string) => {
    setAddDefaultItemId(parentId);
    setAddOpen(true);
  };

  const renderTotals = (g: GroupRow) => {
    const entries = Object.entries(g.totals_by_uom);
    if (entries.length === 0) return "—";
    return (
      <div className="flex flex-col items-end tabular-nums">
        {entries.map(([uom, v]) => (
          <span key={uom}>{fmtNum(v)} {uom}</span>
        ))}
      </div>
    );
  };

  const renderStatusBreakdown = (g: GroupRow) => {
    const sc = g.status_counts;
    const parts: string[] = [];
    if (sc.available) parts.push(`${sc.available} avail`);
    if (sc.reserved) parts.push(`${sc.reserved} res`);
    if (sc.consumed) parts.push(`${sc.consumed} cons`);
    if (sc.scrapped) parts.push(`${sc.scrapped} scrap`);
    return parts.length ? <span className="text-xs text-muted-foreground">{parts.join(" · ")}</span> : null;
  };

  const columns = useMemo<DataTableColumn<AnyRow>[]>(() => [
    {
      key: "primary",
      header: view === "grouped" ? "Item / Piece" : "Piece Code",
      render: (r) => {
        if (r.rowType === "group") {
          const isOpen = expanded.has(r.parent_item_id);
          return (
            <div className="flex items-center gap-2">
              <Button
                size="icon" variant="ghost" className="h-6 w-6"
                onClick={(e) => { e.stopPropagation(); toggleExpanded(r.parent_item_id); }}
                aria-label={isOpen ? "Collapse" : "Expand"}
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
              <div className="flex flex-col">
                <span className="font-mono text-xs font-semibold">{r.parent_item_code}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[320px]">{r.parent_item_name}</span>
              </div>
            </div>
          );
        }
        return (
          <div className={cn("flex flex-col", view === "grouped" && "pl-8")}>
            <span className="font-mono text-xs">{r.piece_code}</span>
            {view === "flat" && (
              <span className="text-xs text-muted-foreground">
                <span className="font-mono">{r.parent_item_code}</span> · {r.parent_item_name}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "size_or_count",
      header: view === "grouped" ? "Pieces / Total" : "Size",
      className: "text-right whitespace-nowrap",
      render: (r) => {
        if (r.rowType === "group") {
          return (
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-medium tabular-nums">{r.piece_count} pcs</span>
              {renderTotals(r)}
              {renderStatusBreakdown(r)}
            </div>
          );
        }
        return (
          <span className="tabular-nums">
            {fmtNum(Number(r.size_value))} {r.size_uom}
          </span>
        );
      },
    },
    {
      key: "location",
      header: "Location / Bin",
      render: (r) => {
        if (r.rowType === "group") {
          return <span className="text-xs text-muted-foreground">{r.location_count} location{r.location_count === 1 ? "" : "s"}</span>;
        }
        return (
          <div className="flex flex-col">
            <span>{r.location_name}</span>
            <span className="text-xs text-muted-foreground font-mono">{r.bin_code ?? "—"}</span>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (r) => {
        if (r.rowType === "group") return null;
        return <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">{r.status}</Badge>;
      },
    },
    {
      key: "source",
      header: "Source",
      render: (r) => (r.rowType === "group" ? null : (r.source_ref ?? "—")),
    },
    {
      key: "age",
      header: "Age",
      className: "text-right tabular-nums",
      render: (r) => (r.rowType === "group"
        ? <span className="text-xs text-muted-foreground">oldest {r.oldest_age_days}d</span>
        : `${r.age_days}d`),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => {
        if (r.rowType === "group") {
          return (
            <Button
              size="sm" variant="ghost"
              onClick={(e) => { e.stopPropagation(); openAddForGroup(r.parent_item_id); }}
              title="Add piece for this item"
            >
              <Plus className="mr-1 h-3 w-3" /> Add
            </Button>
          );
        }
        return (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => setEditPiece(r)} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost"
              disabled={r.status !== "available" && r.status !== "reserved"}
              onClick={() => setConsumePiece(r)} title="Consume">
              <PackageMinus className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost"
              disabled={r.status !== "available"}
              onClick={() => setSplitPiece(r)} title="Split">
              <Scissors className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ], [view, expanded]);

  function exportCsv() {
    downloadCsv(`partial-pieces-${new Date().toISOString().slice(0,10)}.csv`, toCsv(rows));
  }
  function exportSummary() {
    downloadCsv(`partial-pieces-summary-${new Date().toISOString().slice(0,10)}.csv`, summaryCsv(groups));
  }

  const countLabel = view === "grouped"
    ? `${groups.length} item${groups.length === 1 ? "" : "s"} · ${rows.length} piece${rows.length === 1 ? "" : "s"}`
    : `${rows.length} pieces`;

  return (
    <div className="space-y-4 p-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Partial Pieces (Remnants)</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Track individual offcuts and cut pieces of items (e.g. wire lengths) — independent of inventory bin stock.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" /> Export pieces
              </Button>
              {view === "grouped" && (
                <Button variant="outline" onClick={exportSummary}>
                  <Download className="mr-2 h-4 w-4" /> Export summary
                </Button>
              )}
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" /> Import
              </Button>
              <Button onClick={() => openAddForGroup(undefined)}>
                <Plus className="mr-2 h-4 w-4" /> Add piece
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search piece, item, label, source…"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PIECE_STATUS_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={parentItemId} onValueChange={setParentItemId}>
              <SelectTrigger className="w-[260px]"><SelectValue placeholder="All items" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All items</SelectItem>
                {itemOptions.map(o => (
                  <SelectItem key={o.parent_item_id} value={o.parent_item_id}>
                    <span className="font-mono text-xs mr-2">{o.item_code}</span>
                    <span className="text-xs text-muted-foreground">{o.item_name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({o.piece_count})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 rounded-md border p-0.5">
              <Button
                size="sm"
                variant={view === "grouped" ? "secondary" : "ghost"}
                className="h-7 px-2"
                onClick={() => setView("grouped")}
                title="Group by item"
              >
                <Layers className="mr-1 h-3 w-3" /> Grouped
              </Button>
              <Button
                size="sm"
                variant={view === "flat" ? "secondary" : "ghost"}
                className="h-7 px-2"
                onClick={() => setView("flat")}
                title="Flat list"
              >
                <ListIcon className="mr-1 h-3 w-3" /> Flat
              </Button>
            </div>

            {view === "grouped" && groups.length > 0 && (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={expandAll}>Expand all</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={collapseAll}>Collapse all</Button>
              </div>
            )}

            <span className="text-sm text-muted-foreground ml-auto">
              {isLoading ? "Loading…" : countLabel}
            </span>
          </div>

          {globalLocationId && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm">
              <Badge variant="secondary">Showing</Badge>
              <span className="text-muted-foreground">Filtered by location:</span>
              <span className="font-medium">{activeLocationName ?? "Selected location"}</span>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-7 px-2"
                onClick={() => setGlobalLocationId(null)}
              >
                <X className="mr-1 h-3 w-3" /> Clear filter
              </Button>
            </div>
          )}

          <VirtualTable<AnyRow>
            data={tableRows}
            columns={columns}
            getRowId={(r) => r.id}
            isLoading={isLoading}
            rowClassName={(r) => r.rowType === "group" ? "bg-muted/30 font-medium" : ""}
            emptyMessage={
              globalLocationId
                ? `No partial pieces at ${activeLocationName ?? "this location"}. Clear the filter to see other locations, or use "Add piece" to register one here.`
                : "No partial pieces yet. Use “Add piece” or “Import” to register offcuts."
            }
          />
        </CardContent>
      </Card>

      <AddPartialPieceDialog
        open={addOpen}
        onOpenChange={(v) => { setAddOpen(v); if (!v) setAddDefaultItemId(undefined); }}
        defaultParentItemId={addDefaultItemId}
      />
      <ImportPartialPiecesDialog open={importOpen} onOpenChange={setImportOpen} />
      <EditPartialPieceDialog open={!!editPiece} piece={editPiece} onOpenChange={(v) => !v && setEditPiece(null)} />
      <ConsumePartialPieceDialog open={!!consumePiece} piece={consumePiece} onOpenChange={(v) => !v && setConsumePiece(null)} />
      <SplitPartialPieceDialog open={!!splitPiece} piece={splitPiece} onOpenChange={(v) => !v && setSplitPiece(null)} />
    </div>
  );
}
