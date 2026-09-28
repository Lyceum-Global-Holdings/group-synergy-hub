import { useEffect, useState } from "react";
import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePackSalesOrder, useSalesOrderPackLines } from "@/hooks/usePickPackWork";

interface Props {
  salesOrder: { id: string; order_number: string } | null;
  onOpenChange: (open: boolean) => void;
}

/** Pack what has been picked: quantities per line, package number, and package details. */
export function PackOrderDialog({ salesOrder, onOpenChange }: Props) {
  const { data: lines = [], isLoading } = useSalesOrderPackLines(salesOrder?.id);
  const pack = usePackSalesOrder();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [pkg, setPkg] = useState<Record<string, string>>({});
  const [packageType, setPackageType] = useState("Carton");
  const [weight, setWeight] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [notes, setNotes] = useState("");

  const packable = lines.filter((l) => l.quantity_picked - l.quantity_packed > 0);

  useEffect(() => {
    // Start with everything picked and not yet packed, all in package 1.
    setQty(Object.fromEntries(lines.map((l) => [l.id, String(Math.max(l.quantity_picked - l.quantity_packed, 0))])));
    setPkg(Object.fromEntries(lines.map((l) => [l.id, "1"])));
  }, [lines]);

  const parsed = packable.map((l) => ({ line: l, q: Number(qty[l.id] ?? ""), p: Number(pkg[l.id] ?? "1") }));
  const bad = parsed.find((x) => Number.isNaN(x.q) || x.q < 0 || x.q > x.line.quantity_picked - x.line.quantity_packed || !Number.isInteger(x.p) || x.p < 1);
  const chosen = parsed.filter((x) => x.q > 0);
  const weightValue = weight.trim() === "" ? null : Number(weight);
  const weightBad = weightValue !== null && (Number.isNaN(weightValue) || weightValue < 0);

  const submit = () => {
    if (!salesOrder) return;
    pack.mutate(
      {
        salesOrderId: salesOrder.id,
        lines: chosen.map((x) => ({ sales_order_item_id: x.line.id, quantity_packed: x.q, package_number: x.p })),
        packageType, packageWeight: weightValue, packageDimensions: dimensions, notes,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={!!salesOrder} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pack order {salesOrder?.order_number}</DialogTitle>
          <DialogDescription>Record what goes into the package. When everything picked is packed, the order is ready for a delivery order.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-6 text-center text-muted-foreground">Loading lines…</p>
        ) : packable.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">Nothing is picked and waiting to be packed.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Picked</TableHead>
                <TableHead className="text-right">Packed</TableHead>
                <TableHead className="w-28">Pack now</TableHead>
                <TableHead className="w-24">Package #</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packable.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.item_name ?? "Item"}</TableCell>
                  <TableCell className="text-right">{l.quantity_picked}</TableCell>
                  <TableCell className="text-right">{l.quantity_packed}</TableCell>
                  <TableCell>
                    <Input inputMode="decimal" aria-label={`Quantity of ${l.item_name} to pack`} value={qty[l.id] ?? ""}
                      onChange={(e) => setQty((p) => ({ ...p, [l.id]: e.target.value }))} />
                  </TableCell>
                  <TableCell>
                    <Input inputMode="numeric" aria-label={`Package number for ${l.item_name}`} value={pkg[l.id] ?? "1"}
                      onChange={(e) => setPkg((p) => ({ ...p, [l.id]: e.target.value }))} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="pack-type">Package type</Label>
            <Input id="pack-type" value={packageType} onChange={(e) => setPackageType(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pack-weight">Weight (kg)</Label>
            <Input id="pack-weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pack-dims">Dimensions</Label>
            <Input id="pack-dims" placeholder="e.g. 60x40x40 cm" value={dimensions} onChange={(e) => setDimensions(e.target.value)} />
          </div>
        </div>
        <Textarea aria-label="Packing notes" placeholder="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        {bad && <p className="text-sm text-destructive">Check the quantity and package number for {bad.line.item_name}.</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!!bad || weightBad || chosen.length === 0 || pack.isPending}>
            <PackageCheck className="mr-2 h-4 w-4" /> Record package
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
