import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shirt, ShoppingCart, Boxes, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { Costume } from "@/types/costumeRental";
import { costumeSizeOptions, sizeLabel } from "./sizeUtils";
import { AddToBucketDialog } from "./AddToBucketDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costume: Costume | null;
  onManageUnits?: (c: Costume) => void;
  onEdit?: (c: Costume) => void;
}

const STATUS_VARIANT = {
  active: "default" as const,
  inactive: "secondary" as const,
  retired: "destructive" as const,
};

export function CostumeDetailDialog({ open, onOpenChange, costume, onManageUnits, onEdit }: Props) {
  const sizes = useMemo(() => costumeSizeOptions(costume), [costume]);
  const [addOpen, setAddOpen] = useState(false);
  if (!costume) return null;

  const attrs: [string, string | null | undefined][] = [
    ["Category", costume.category?.name],
    ["Color", costume.color],
    ["Gender", costume.gender],
    ["Theme / Era", costume.theme],
    ["Brand", costume.brand],
  ];
  const totalUnits = costume.units?.length ?? 0;
  const availableUnits = (costume.units ?? []).filter((u) => u.status === "available").length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {costume.name}
              <Badge variant={STATUS_VARIANT[costume.status]} className="capitalize">{costume.status}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="aspect-[4/3] rounded-lg bg-muted overflow-hidden flex items-center justify-center">
              {costume.image_url
                ? <img src={costume.image_url} alt={costume.name} className="h-full w-full object-cover" />
                : <Shirt className="h-12 w-12 text-muted-foreground" />}
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-mono text-xs text-muted-foreground">{costume.costume_code}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <span><span className="text-muted-foreground">Daily rate: </span><b>{formatCurrency(costume.daily_rate)}</b></span>
                {costume.flat_rate != null && <span><span className="text-muted-foreground">Flat rate: </span>{formatCurrency(costume.flat_rate)}</span>}
                <span><span className="text-muted-foreground">Deposit: </span>{formatCurrency(costume.security_deposit)}</span>
                <span><span className="text-muted-foreground">Replacement: </span>{formatCurrency(costume.replacement_value)}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
                {attrs.filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}><span className="text-muted-foreground">{k}: </span>{v}</div>
                ))}
              </div>
              {costume.description && <p className="text-muted-foreground pt-1">{costume.description}</p>}
            </div>
          </div>

          {/* Sizes & availability */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Sizes & units <span className="text-muted-foreground font-normal">({availableUnits}/{totalUnits} available)</span></p>
            {totalUnits === 0 ? (
              <p className="text-sm text-muted-foreground">No physical units yet. Add units to make this costume rentable.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <div key={s.size || "_one"} className="rounded-md border px-3 py-1.5 text-sm">
                    <span className="font-medium">{sizeLabel(s.size)}</span>
                    <span className="text-muted-foreground ml-2">{s.available}/{s.total} available</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              {onManageUnits && <Button variant="outline" onClick={() => onManageUnits(costume)}><Boxes className="h-4 w-4 mr-2" /> Units</Button>}
              {onEdit && <Button variant="ghost" onClick={() => onEdit(costume)}><Pencil className="h-4 w-4 mr-2" /> Edit</Button>}
            </div>
            <Button onClick={() => setAddOpen(true)} disabled={costume.status !== "active" || totalUnits === 0}>
              <ShoppingCart className="h-4 w-4 mr-2" /> Add to bucket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddToBucketDialog open={addOpen} onOpenChange={setAddOpen} costume={costume} />
    </>
  );
}
