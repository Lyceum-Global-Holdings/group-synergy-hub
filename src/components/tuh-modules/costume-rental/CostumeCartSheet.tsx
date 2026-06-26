import { useMemo, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shirt, Trash2, ShoppingCart } from "lucide-react";
import { useCostumeCart } from "@/contexts/CostumeCartContext";
import { useCostumes } from "@/hooks/useCostumes";
import { formatCurrency } from "@/lib/utils";
import type { Costume } from "@/types/costumeRental";
import { CreateRentalOrderDialog } from "./CreateRentalOrderDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
}

export function CostumeCartSheet({ open, onOpenChange, companyId }: Props) {
  const { items, setQuantity, remove, clear } = useCostumeCart();
  const { costumes } = useCostumes(companyId);
  const [createOpen, setCreateOpen] = useState(false);

  const byId = useMemo(() => new Map(costumes.map((c: Costume) => [c.id, c])), [costumes]);
  const indicativeDaily = items.reduce((s, it) => {
    const c = byId.get(it.costume_id);
    return s + (c ? Number(c.daily_rate) * it.quantity : 0);
  }, 0);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> Costume bucket
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-2 py-2">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">
                Your bucket is empty. Add costumes from the catalog.
              </p>
            )}
            {items.map((it) => {
              const c = byId.get(it.costume_id);
              return (
                <div key={`${it.costume_id}-${it.size}`} className="flex items-center gap-3 rounded-md border p-2">
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {c?.image_url ? <img src={c.image_url} alt="" className="h-full w-full object-cover" /> : <Shirt className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {c?.name ?? "Costume"}
                      {it.size && <span className="ml-1 text-xs text-muted-foreground">· {it.size}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{c ? `${formatCurrency(c.daily_rate)}/day` : it.costume_id.slice(0, 8)}</p>
                  </div>
                  <Input
                    type="number" min={1} className="w-16 h-8"
                    value={it.quantity}
                    onChange={(e) => setQuantity(it.costume_id, it.size, Math.max(1, Number(e.target.value) || 1))}
                  />
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(it.costume_id, it.size)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>

          {items.length > 0 && (
            <SheetFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
              <div className="flex justify-between text-sm w-full">
                <span className="text-muted-foreground">Indicative / day</span>
                <span className="font-medium">{formatCurrency(indicativeDaily)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Final price depends on the rental dates you pick next.</p>
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1" onClick={clear}>Clear</Button>
                <Button className="flex-1" onClick={() => setCreateOpen(true)} disabled={!companyId}>
                  Create rental order
                </Button>
              </div>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <CreateRentalOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companyId={companyId}
        initialItems={items}
        onCreated={() => { clear(); onOpenChange(false); }}
      />
    </>
  );
}
