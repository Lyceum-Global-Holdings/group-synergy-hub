import { useEffect, useState } from "react";
import { Play, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirmPickList, usePickListLines, useStartPickList } from "@/hooks/usePickPackWork";

interface Props {
  pickList: { id: string; pick_list_number: string; status: string; sales_order?: { order_number?: string } | null } | null;
  onOpenChange: (open: boolean) => void;
}

type Entry = { qty: string; notFound: boolean; notes: string };

const lineStatus: Record<string, string> = { pending: "To pick", picked: "Picked", short_pick: "Short", not_found: "Not found" };

/** Work a pick list: start it, then record what was actually picked for every line. */
export function PickListWorkDialog({ pickList, onOpenChange }: Props) {
  const { data: lines = [], isLoading } = usePickListLines(pickList?.id);
  const start = useStartPickList();
  const confirm = useConfirmPickList();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const open = !!pickList;
  const editable = !!pickList && ["pending", "assigned", "in_progress"].includes(pickList.status);

  useEffect(() => {
    // Start each line at the full quantity to pick; the picker lowers it for shortages.
    setEntries(Object.fromEntries(lines.map((l) => [l.id, { qty: String(Number(l.quantity_to_pick)), notFound: false, notes: "" }])));
  }, [lines]);

  const parsed = lines.map((l) => {
    const e = entries[l.id];
    const qty = e?.notFound ? 0 : Number(e?.qty ?? "");
    return { line: l, qty, notFound: !!e?.notFound, notes: e?.notes ?? "" };
  });
  const invalid = parsed.find((p) => Number.isNaN(p.qty) || p.qty < 0 || p.qty > Number(p.line.quantity_to_pick));
  const short = parsed.filter((p) => p.qty < Number(p.line.quantity_to_pick)).length;

  const submit = () => {
    if (!pickList) return;
    confirm.mutate(
      {
        pickListId: pickList.id,
        lines: parsed.map((p) => ({ pick_list_item_id: p.line.id, quantity_picked: p.qty, not_found: p.notFound, notes: p.notes || undefined })),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const set = (id: string, patch: Partial<Entry>) => setEntries((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pick list {pickList?.pick_list_number}</DialogTitle>
          <DialogDescription>
            Order {pickList?.sales_order?.order_number ?? "—"} ·{" "}
            {pickList?.status === "in_progress" ? "Picking in progress" : pickList?.status === "completed" ? "Picked" : "Not started"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-6 text-center text-muted-foreground">Loading lines…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>From</TableHead>
                <TableHead className="text-right">To pick</TableHead>
                <TableHead className="w-28">Picked</TableHead>
                {editable ? <TableHead>Not found</TableHead> : <TableHead>Result</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => {
                const name = l.finished_goods?.product_name ?? "Item";
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{name}</div>
                      {l.finished_goods?.product_code && <div className="text-xs text-muted-foreground">{l.finished_goods.product_code}</div>}
                    </TableCell>
                    <TableCell>
                      {l.warehouse_bins?.bin_code ?? "—"}
                      {l.warehouse_locations?.name && <div className="text-xs text-muted-foreground">{l.warehouse_locations.name}</div>}
                    </TableCell>
                    <TableCell className="text-right">{Number(l.quantity_to_pick)}</TableCell>
                    <TableCell>
                      {editable ? (
                        <Input inputMode="decimal" aria-label={`Picked quantity of ${name}`}
                          value={entries[l.id]?.notFound ? "0" : entries[l.id]?.qty ?? ""}
                          disabled={entries[l.id]?.notFound}
                          onChange={(e) => set(l.id, { qty: e.target.value })} />
                      ) : (
                        Number(l.quantity_picked ?? 0)
                      )}
                    </TableCell>
                    <TableCell>
                      {editable ? (
                        <Checkbox aria-label={`${name} not found`} checked={entries[l.id]?.notFound ?? false}
                          onCheckedChange={(c) => set(l.id, { notFound: !!c })} />
                      ) : (
                        <Badge variant={l.status === "picked" ? "default" : "secondary"}>{lineStatus[l.status] ?? l.status}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {editable && short > 0 && !invalid && (
          <p className="text-sm text-muted-foreground">
            {short} line{short === 1 ? " is" : "s are"} short. The rest can go on a new pick list for the same order.
          </p>
        )}
        {editable && invalid && (
          <p className="text-sm text-destructive">Picked quantity for {invalid.line.finished_goods?.product_name ?? "a line"} must be between 0 and {Number(invalid.line.quantity_to_pick)}.</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {pickList && ["pending", "assigned"].includes(pickList.status) && (
            <Button variant="outline" onClick={() => start.mutate(pickList.id)} disabled={start.isPending}>
              <Play className="mr-2 h-4 w-4" /> Start picking
            </Button>
          )}
          {editable && (
            <Button onClick={submit} disabled={!!invalid || lines.length === 0 || confirm.isPending}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm pick
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
