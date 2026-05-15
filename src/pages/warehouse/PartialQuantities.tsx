import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VirtualTable, type DataTableColumn } from "@/components/shared/VirtualTable";
import { Download, Pencil, PackageMinus, Scissors, Search, Upload, Plus } from "lucide-react";
import { usePartialPieces, usePartialPieceItems } from "@/hooks/warehouse/usePartialPieces";
import { PIECE_STATUS_OPTIONS, type PartialPieceRow, type PartialPieceStatus } from "@/types/partialPiece";
import { AddPartialPieceDialog } from "@/components/warehouse/partial-qty/AddPartialPieceDialog";
import { EditPartialPieceDialog } from "@/components/warehouse/partial-qty/EditPartialPieceDialog";
import { ConsumePartialPieceDialog } from "@/components/warehouse/partial-qty/ConsumePartialPieceDialog";
import { SplitPartialPieceDialog } from "@/components/warehouse/partial-qty/SplitPartialPieceDialog";
import { ImportPartialPiecesDialog } from "@/components/warehouse/partial-qty/ImportPartialPiecesDialog";

const STATUS_VARIANT: Record<PartialPieceStatus, "default" | "secondary" | "outline" | "destructive"> = {
  available: "default",
  reserved: "secondary",
  consumed: "outline",
  scrapped: "destructive",
};

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

export default function PartialQuantities() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("available");
  const { data: rows = [], isLoading } = usePartialPieces({ search, status });

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editPiece, setEditPiece] = useState<PartialPieceRow | null>(null);
  const [consumePiece, setConsumePiece] = useState<PartialPieceRow | null>(null);
  const [splitPiece, setSplitPiece] = useState<PartialPieceRow | null>(null);

  const columns = useMemo<DataTableColumn<PartialPieceRow>[]>(() => [
    { key: "piece_code", header: "Piece Code", className: "font-mono whitespace-nowrap",
      render: (r) => r.piece_code },
    { key: "parent", header: "Parent Item", render: (r) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs">{r.parent_item_code}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[260px]">{r.parent_item_name}</span>
        </div>
      ) },
    { key: "size", header: "Size", className: "text-right tabular-nums whitespace-nowrap",
      render: (r) => `${Number(r.size_value).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${r.size_uom}` },
    { key: "location", header: "Location / Bin", render: (r) => (
        <div className="flex flex-col">
          <span>{r.location_name}</span>
          <span className="text-xs text-muted-foreground font-mono">{r.bin_code ?? "—"}</span>
        </div>
      ) },
    { key: "status", header: "Status",
      render: (r) => <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">{r.status}</Badge> },
    { key: "source", header: "Source", render: (r) => r.source_ref ?? "—" },
    { key: "age", header: "Age", className: "text-right tabular-nums",
      render: (r) => `${r.age_days}d` },
    { key: "actions", header: "Actions", render: (r) => (
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
      ) },
  ], []);

  function exportCsv() {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `partial-pieces-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

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
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" /> Import
              </Button>
              <Button onClick={() => setAddOpen(true)}>
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
            <span className="text-sm text-muted-foreground ml-auto">
              {isLoading ? "Loading…" : `${rows.length} pieces`}
            </span>
          </div>

          <VirtualTable<PartialPieceRow>
            data={rows}
            columns={columns}
            getRowId={(r) => r.id}
            isLoading={isLoading}
            emptyMessage="No partial pieces yet. Use “Add piece” or “Import” to register offcuts."
          />
        </CardContent>
      </Card>

      <AddPartialPieceDialog open={addOpen} onOpenChange={setAddOpen} />
      <ImportPartialPiecesDialog open={importOpen} onOpenChange={setImportOpen} />
      <EditPartialPieceDialog open={!!editPiece} piece={editPiece} onOpenChange={(v) => !v && setEditPiece(null)} />
      <ConsumePartialPieceDialog open={!!consumePiece} piece={consumePiece} onOpenChange={(v) => !v && setConsumePiece(null)} />
      <SplitPartialPieceDialog open={!!splitPiece} piece={splitPiece} onOpenChange={(v) => !v && setSplitPiece(null)} />
    </div>
  );
}
