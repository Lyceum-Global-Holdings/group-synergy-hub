import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useImportPartialPieces } from "@/hooks/warehouse/usePartialPieces";
import { downloadPartialPieceTemplate, PARTIAL_PIECE_COLUMNS, REQUIRED_COLUMNS } from "./importTemplate";
import { parseCSV } from "@/lib/bulkImport/csvParser";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ImportPartialPiecesDialog({ open, onOpenChange }: Props) {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const importMut = useImportPartialPieces();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [errors, setErrors] = useState<Array<{ row: number; error: string }>>([]);
  const [result, setResult] = useState<{ inserted: number } | null>(null);

  function reset() { setRows([]); setFileName(""); setErrors([]); setResult(null); }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const text = await f.text();
    const matrix = parseCSV(text);
    if (matrix.length < 2) { toast({ title: "Empty file", variant: "destructive" }); return; }
    const header = matrix[0].map(h => h.trim());
    const missing = REQUIRED_COLUMNS.filter(c => !header.includes(c));
    if (missing.length) {
      toast({ title: `Missing required columns: ${missing.join(", ")}`, variant: "destructive" });
      return;
    }
    const parsed = matrix.slice(1)
      .filter(r => r.some(c => c.trim() !== ""))
      .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));

    // client-side validation
    const localErrors: Array<{ row: number; error: string }> = [];
    parsed.forEach((row, idx) => {
      if (!row.parent_item_code) localErrors.push({ row: idx + 2, error: "parent_item_code required" });
      if (!row.location_code) localErrors.push({ row: idx + 2, error: "location_code required" });
      const sv = Number(row.size_value);
      if (!sv || sv <= 0) localErrors.push({ row: idx + 2, error: "size_value must be > 0" });
    });
    setErrors(localErrors);
    setRows(parsed);
  }

  async function submit() {
    if (!selectedCompany?.id || rows.length === 0) return;
    if (errors.length) { toast({ title: "Fix validation errors first", variant: "destructive" }); return; }
    try {
      const res = await importMut.mutateAsync({
        company_id: selectedCompany.id,
        rows: rows as Record<string, unknown>[],
      });
      setResult({ inserted: res.inserted });
      setErrors(res.errors.map(e => ({ row: e.row, error: e.error })));
      toast({ title: `Imported ${res.inserted} pieces`, description: res.errors.length ? `${res.errors.length} errors` : undefined });
    } catch (e) {
      toast({ title: "Import failed", description: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Partial Pieces</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadPartialPieceTemplate}>
              <Download className="mr-2 h-4 w-4" /> Download template
            </Button>
            <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer text-sm hover:bg-accent">
              <Upload className="h-4 w-4" />
              {fileName || "Choose CSV file"}
              <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            Required: <code>{REQUIRED_COLUMNS.join(", ")}</code>. All columns: <code>{PARTIAL_PIECE_COLUMNS.join(", ")}</code>.
          </p>

          {rows.length > 0 && (
            <div className="text-sm">
              <div className="font-medium">Preview: {rows.length} rows</div>
              {errors.length > 0 && (
                <div className="mt-2 max-h-40 overflow-auto border rounded p-2 bg-destructive/5 text-destructive text-xs space-y-1">
                  {errors.slice(0, 50).map((e, i) => (
                    <div key={i}>Row {e.row}: {e.error}</div>
                  ))}
                  {errors.length > 50 && <div>… and {errors.length - 50} more</div>}
                </div>
              )}
              {result && (
                <div className="mt-2 text-primary">Inserted {result.inserted} pieces.</div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={submit} disabled={!rows.length || importMut.isPending || errors.length > 0}>
            {importMut.isPending ? "Importing…" : `Import ${rows.length} rows`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
