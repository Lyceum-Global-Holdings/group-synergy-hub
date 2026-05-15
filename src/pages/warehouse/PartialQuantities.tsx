import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { VirtualTable, type DataTableColumn } from "@/components/shared/VirtualTable";
import { Download, PackageMinus, Search } from "lucide-react";
import {
  usePartialQuantities,
  type PartialQuantityRow,
} from "@/hooks/warehouse/usePartialQuantities";
import { IssuePartialQuantityDialog } from "@/components/warehouse/partial-qty/IssuePartialQuantityDialog";

function toCsv(rows: PartialQuantityRow[]): string {
  const head = [
    "item_code", "item_name", "location", "bin", "uom",
    "allocated_qty", "reserved_qty", "available_qty",
    "secondary_qty", "secondary_uom", "unit_cost", "total_value", "fifo_rank",
  ];
  const body = rows.map((r) => [
    r.item_code, r.item_name, r.location_name ?? "", r.bin_code, r.base_uom ?? "",
    r.allocated_quantity, r.reserved_quantity, r.available_quantity,
    r.secondary_quantity ?? "", r.secondary_uom ?? "",
    r.unit_cost ?? "", r.total_value ?? "", r.fifo_rank,
  ]
    .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
    .join(","));
  return [head.join(","), ...body].join("\n");
}

export default function PartialQuantities() {
  const [search, setSearch] = useState("");
  const { data: rows = [], isLoading } = usePartialQuantities(search);
  const [active, setActive] = useState<PartialQuantityRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const columns = useMemo<DataTableColumn<PartialQuantityRow>[]>(
    () => [
      {
        key: "item_code",
        header: "Item Code",
        className: "font-mono whitespace-nowrap",
        render: (r) => (
          <div className="flex items-center gap-2">
            <span>{r.item_code}</span>
            {r.fifo_rank === 1 && (
              <Badge variant="secondary" className="text-[10px]">FIFO</Badge>
            )}
          </div>
        ),
      },
      { key: "item_name", header: "Description", render: (r) => r.item_name },
      { key: "location", header: "Location", render: (r) => r.location_name ?? "—" },
      { key: "bin", header: "Bin", className: "font-mono", render: (r) => r.bin_code },
      {
        key: "allocated",
        header: "On Hand",
        className: "text-right tabular-nums",
        render: (r) => (
          <span>
            {Number(r.allocated_quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
            <span className="text-muted-foreground">{r.base_uom}</span>
          </span>
        ),
      },
      {
        key: "reserved",
        header: "Reserved",
        className: "text-right tabular-nums text-muted-foreground",
        render: (r) => Number(r.reserved_quantity ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 }),
      },
      {
        key: "available",
        header: "Available",
        className: "text-right tabular-nums font-medium",
        render: (r) => Number(r.available_quantity ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 }),
      },
      {
        key: "secondary",
        header: "Secondary",
        className: "text-right tabular-nums",
        render: (r) =>
          r.track_secondary_quantity
            ? `${Number(r.secondary_quantity ?? 0)} ${r.secondary_uom ?? ""}`
            : "—",
      },
      {
        key: "value",
        header: "Value",
        className: "text-right tabular-nums",
        render: (r) =>
          r.total_value != null
            ? Number(r.total_value).toLocaleString(undefined, { maximumFractionDigits: 2 })
            : "—",
      },
      {
        key: "action",
        header: "",
        className: "text-right",
        render: (r) => (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setActive(r);
              setDialogOpen(true);
            }}
          >
            <PackageMinus className="h-4 w-4 mr-1" /> Issue
          </Button>
        ),
      },
    ],
    [],
  );

  const exportCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `partial-quantities-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Partial Quantities</h1>
          <p className="text-muted-foreground">
            One row per (item × location × bin) holding. Issue directly from any row.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Open holdings</CardTitle>
          <div className="relative max-w-sm pt-2">
            <Search className="absolute left-2.5 top-4.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search item code, name, or bin…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <VirtualTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            ariaLabel="Partial quantities"
            emptyMessage="No open holdings for this scope."
            estimatedRowHeight={44}
            maxHeight={680}
            getRowId={(r) => String(r.allocation_id)}
          />
        </CardContent>
      </Card>

      <IssuePartialQuantityDialog
        row={active}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setActive(null);
        }}
      />
    </div>
  );
}
