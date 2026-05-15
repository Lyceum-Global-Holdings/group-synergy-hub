import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { parseCSV, downloadCSV } from "@/lib/bulkImport/csvParser";
import {
  PARTIAL_IMPORT_COLUMNS,
  REQUIRED_COLUMNS,
  downloadPartialQtyTemplate,
  type PartialImportColumn,
} from "./importTemplate";
import {
  useImportPartialQuantities,
  type PartialImportRow,
} from "@/hooks/warehouse/useImportPartialQuantities";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow extends PartialImportRow {
  rowNumber: number;
  errors: string[];
}

function validate(row: PartialImportRow): string[] {
  const errs: string[] = [];
  for (const col of REQUIRED_COLUMNS) {
    const v = (row as Record<string, unknown>)[col];
    if (v === undefined || v === null || String(v).trim() === "") {
      errs.push(`${col} required`);
    }
  }
  const qty = Number(row.quantity);
  if (Number.isNaN(qty) || qty < 0) errs.push("quantity invalid");
  if ((row.mode ?? "add") === "add" && qty === 0) errs.push("quantity > 0 for add mode");
  if (row.mode && !["add", "set"].includes(row.mode)) errs.push("mode must be add or set");
  if (row.unit_cost != null && row.unit_cost !== "" && Number.isNaN(Number(row.unit_cost))) {
    errs.push("unit_cost invalid");
  }
  if (row.expiry_date && row.manufacture_date && row.expiry_date < row.manufacture_date) {
    errs.push("expiry_date before manufacture_date");
  }
  return errs;
}

export function ImportPartialQuantitiesDialog({ open, onOpenChange }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [allowCreateBin, setAllowCreateBin] = useState(false);
  const importMutation = useImportPartialQuantities();

  const errorCount = useMemo(() => rows.filter((r) => r.errors.length).length, [rows]);
  const validCount = rows.length - errorCount;

  const reset = () => {
    setFile(null);
    setRows([]);
  };

  const handleFile = async (f: File) => {
    setFile(f);
    const text = await f.text();
    const matrix = parseCSV(text);
    if (matrix.length < 2) {
      toast.error("Empty CSV");
      return;
    }
    const headers = matrix[0].map((h) => h.toLowerCase().trim());
    const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
    if (missing.length) {
      toast.error(`Missing columns: ${missing.join(", ")}`);
      return;
    }
    const parsed: ParsedRow[] = matrix.slice(1).map((cells, i) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        if ((PARTIAL_IMPORT_COLUMNS as readonly string[]).includes(h)) {
          obj[h] = cells[idx] ?? "";
        }
      });
      const row: PartialImportRow = {
        item_code: obj.item_code ?? "",
        location_code: obj.location_code ?? "",
        bin_code: obj.bin_code ?? "",
        quantity: obj.quantity ?? "",
        secondary_quantity: obj.secondary_quantity || null,
        batch_number: obj.batch_number || null,
        manufacture_date: obj.manufacture_date || null,
        expiry_date: obj.expiry_date || null,
        unit_cost: obj.unit_cost || null,
        received_at: obj.received_at || null,
        reference: obj.reference || null,
        notes: obj.notes || null,
        mode: (obj.mode || "add").toLowerCase() as "add" | "set",
      };
      return { ...row, rowNumber: i + 2, errors: validate(row) };
    });
    setRows(parsed);
  };

  const downloadErrors = () => {
    const errored = rows.filter((r) => r.errors.length);
    if (!errored.length) return;
    downloadCSV(
      "partial-quantities-errors.csv",
      [...PARTIAL_IMPORT_COLUMNS, "error"],
      errored.map((r) => [
        ...PARTIAL_IMPORT_COLUMNS.map((c) => String((r as Record<string, unknown>)[c] ?? "")),
        r.errors.join("; "),
      ]),
    );
  };

  const submit = async () => {
    if (errorCount > 0) {
      toast.error("Resolve errors before importing");
      return;
    }
    if (!rows.length) return;
    try {
      const payload = rows.map(({ rowNumber: _r, errors: _e, ...rest }) => rest);
      const res = await importMutation.mutateAsync({
        rows: payload,
        allow_create_bin: allowCreateBin,
      });
      toast.success(
        `Imported: ${res.inserted} new, ${res.updated} updated${
          res.batches_created ? `, ${res.batches_created} batches` : ""
        }${res.bins_created ? `, ${res.bins_created} bins created` : ""}`,
      );
      reset();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Import failed: ${msg}`);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Partial Quantities</DialogTitle>
          <DialogDescription>
            Bulk-load bin holdings (item × location × bin × batch). Aligned with GS1 CBV
            and SAP EWM putaway conventions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" onClick={downloadPartialQtyTemplate}>
              <Download className="h-4 w-4 mr-2" /> Download template
            </Button>
            <label className="inline-flex">
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <span className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md cursor-pointer hover:bg-accent">
                <Upload className="h-4 w-4" /> {file ? file.name : "Choose CSV"}
              </span>
            </label>
            <div className="flex items-center gap-2 ml-auto">
              <Checkbox
                id="allow-bin"
                checked={allowCreateBin}
                onCheckedChange={(c) => setAllowCreateBin(c === true)}
              />
              <Label htmlFor="allow-bin" className="text-sm">
                Auto-create missing bins
              </Label>
            </div>
          </div>

          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="secondary">{rows.length} rows</Badge>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {validCount} valid
                </Badge>
                {errorCount > 0 && (
                  <>
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" /> {errorCount} errors
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={downloadErrors}>
                      Download error rows
                    </Button>
                  </>
                )}
              </div>

              <ScrollArea className="border rounded-md max-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Bin</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.rowNumber} className={r.errors.length ? "bg-destructive/5" : ""}>
                        <TableCell className="text-muted-foreground">{r.rowNumber}</TableCell>
                        <TableCell className="font-mono text-xs">{r.item_code}</TableCell>
                        <TableCell>{r.location_code}</TableCell>
                        <TableCell className="font-mono text-xs">{r.bin_code}</TableCell>
                        <TableCell className="text-right tabular-nums">{String(r.quantity)}</TableCell>
                        <TableCell>{r.mode}</TableCell>
                        <TableCell className="font-mono text-xs">{r.batch_number ?? "—"}</TableCell>
                        <TableCell>
                          {r.errors.length ? (
                            <span className="text-destructive text-xs">{r.errors.join(", ")}</span>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              ok
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}

          {!rows.length && (
            <Alert>
              <AlertDescription>
                Required columns: <strong>{REQUIRED_COLUMNS.join(", ")}</strong>. Optional:{" "}
                secondary_quantity, batch_number, manufacture_date, expiry_date, unit_cost,
                received_at, reference, notes, mode (<code>add</code>|<code>set</code>).
                Dates use ISO 8601 (YYYY-MM-DD).
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!rows.length || errorCount > 0 || importMutation.isPending}
          >
            {importMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Import {validCount || ""} rows
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
