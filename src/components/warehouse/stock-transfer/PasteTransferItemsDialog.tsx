import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ClipboardPaste } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  buildTemplateCsv,
  parsePastedRows,
  resolvePastedRows,
  type PasteCatalogItem,
  type ResolvedPasteRow,
} from "./pasteParser";

export interface PastedTransferItem {
  warehouse_item_id: string;
  item_name: string;
  quantity_requested: number;
  unit_of_measure: string;
}

interface PasteTransferItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: PasteCatalogItem[];
  fromBinId: string | null | undefined;
  onConfirm: (items: PastedTransferItem[]) => void;
}

function StatusBadge({ status }: { status: ResolvedPasteRow["status"] }) {
  if (status === "ok") return <Badge variant="secondary">OK</Badge>;
  if (status === "warning")
    return (
      <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
        Warning
      </Badge>
    );
  return <Badge variant="destructive">Error</Badge>;
}

export function PasteTransferItemsDialog({
  open,
  onOpenChange,
  catalog,
  fromBinId,
  onConfirm,
}: PasteTransferItemsDialogProps) {
  const [text, setText] = useState("");
  const [previewed, setPreviewed] = useState(false);

  // On-hand at the source bin (per warehouse_item_id)
  const { data: onHandRows } = useQuery({
    queryKey: ["paste-onhand-by-bin", fromBinId],
    enabled: !!fromBinId && open,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_bin_allocations")
        .select("warehouse_item_id, available_quantity")
        .eq("bin_id", fromBinId as string);
      if (error) throw error;
      return (data ?? []) as Array<{
        warehouse_item_id: string;
        available_quantity: number | null;
      }>;
    },
  });

  const onHandByItemId = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of onHandRows ?? []) {
      m.set(r.warehouse_item_id, Number(r.available_quantity ?? 0));
    }
    return m;
  }, [onHandRows]);

  const resolved = useMemo<ResolvedPasteRow[]>(() => {
    if (!previewed) return [];
    const raw = parsePastedRows(text);
    return resolvePastedRows(raw, catalog, onHandByItemId);
  }, [previewed, text, catalog, onHandByItemId]);

  useEffect(() => {
    if (!open) {
      setText("");
      setPreviewed(false);
    }
  }, [open]);

  const validCount = resolved.filter((r) => r.status !== "error").length;
  const errorCount = resolved.length - validCount;

  const handleDownloadTemplate = () => {
    const blob = new Blob([buildTemplateCsv()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock-transfer-items-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirm = () => {
    const items: PastedTransferItem[] = resolved
      .filter((r) => r.status !== "error" && r.matchedItem)
      .map((r) => ({
        warehouse_item_id: r.matchedItem!.id,
        item_name: r.matchedItem!.name,
        quantity_requested: r.quantity,
        unit_of_measure: r.unit_of_measure,
      }));
    onConfirm(items);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" />
            Paste transfer items
          </DialogTitle>
          <DialogDescription>
            Paste from Excel or a CSV. One line per item — columns:{" "}
            <span className="font-mono">item_code</span>{" "}
            <span className="font-mono">quantity</span>{" "}
            <span className="font-mono">[uom]</span>. Tab, comma, or
            semicolon-separated. Item code matches{" "}
            <span className="font-mono">item_code</span>, barcode/GTIN, or SKU.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground font-mono">
              Example: IT-001&nbsp;&nbsp;50&nbsp;&nbsp;pcs
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDownloadTemplate}
            >
              <Download className="h-4 w-4 mr-1" />
              Template
            </Button>
          </div>

          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPreviewed(false);
            }}
            placeholder={"IT-001\t50\tpcs\nIT-002\t10\nIT-003,25,kg"}
            rows={8}
            className="font-mono text-sm"
            autoFocus
          />

          {!fromBinId && (
            <p className="text-xs text-amber-700">
              Select a Source Bin to validate on-hand quantities.
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewed(true)}
              disabled={!text.trim()}
            >
              Preview
            </Button>
          </div>

          {previewed && resolved.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Line</th>
                    <th className="text-left p-2">Code</th>
                    <th className="text-left p-2">Item</th>
                    <th className="text-right p-2">Qty</th>
                    <th className="text-center p-2">UoM</th>
                    <th className="text-right p-2">On-hand</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {resolved.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 text-muted-foreground">
                        {r.mergedFromLines
                          ? r.mergedFromLines.join(", ")
                          : r.lineNumber}
                      </td>
                      <td className="p-2 font-mono">{r.code || "—"}</td>
                      <td className="p-2">
                        {r.matchedItem?.name ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-2 text-right">{r.quantity || "—"}</td>
                      <td className="p-2 text-center">
                        {r.unit_of_measure || "—"}
                      </td>
                      <td className="p-2 text-right">
                        {r.onHand ?? "—"}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={r.status} />
                          {r.messages.map((m, j) => (
                            <span
                              key={j}
                              className="text-xs text-muted-foreground"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {previewed && resolved.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {validCount} valid · {errorCount} with errors (errors will be
              skipped)
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!previewed || validCount === 0}
          >
            Add {validCount} {validCount === 1 ? "row" : "rows"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
