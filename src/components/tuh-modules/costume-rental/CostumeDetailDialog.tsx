import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shirt, ShoppingCart, Boxes, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
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
  const gallery = useMemo(() => {
    const urls = costume?.image_urls?.length ? costume.image_urls : (costume?.image_url ? [costume.image_url] : []);
    return urls.filter(Boolean);
  }, [costume]);
  const [active, setActive] = useState(0);
  useEffect(() => { setActive(0); }, [costume]);
  if (!costume) return null;

  const attrs: [string, string | null | undefined][] = [
    ["Category", costume.category?.name],
    ["Color", costume.color],
    ["Gender", costume.gender],
    ["Theme / Era", costume.theme],
    ["Brand", costume.brand],
  ].filter(([, v]) => v) as [string, string][];

  const totalUnits = costume.units?.length ?? 0;
  const availableUnits = (costume.units ?? []).filter((u) => u.status === "available").length;
  const rentable = costume.status === "active" && totalUnits > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden gap-0 max-h-[92vh]">
          <DialogTitle className="sr-only">{costume.name}</DialogTitle>
          <div className="grid md:grid-cols-2 max-h-[92vh] overflow-y-auto">

            {/* ── Gallery ───────────────────────────────────────────── */}
            <div className="bg-muted/40 p-4 md:p-6 flex flex-col gap-3">
              <div className="relative aspect-[4/5] rounded-xl bg-background overflow-hidden border flex items-center justify-center group">
                {gallery.length > 0
                  ? <img src={gallery[active]} alt={costume.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  : <Shirt className="h-16 w-16 text-muted-foreground" />}
                {gallery.length > 1 && (
                  <>
                    <button type="button" aria-label="Previous image"
                      onClick={() => setActive((a) => (a - 1 + gallery.length) % gallery.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/90 shadow rounded-full p-1.5 hover:bg-background">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button type="button" aria-label="Next image"
                      onClick={() => setActive((a) => (a + 1) % gallery.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/90 shadow rounded-full p-1.5 hover:bg-background">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <span className="absolute bottom-2 right-2 text-xs font-medium bg-background/90 shadow rounded-full px-2 py-0.5">{active + 1} / {gallery.length}</span>
                  </>
                )}
              </div>
              {gallery.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {gallery.map((u, i) => (
                    <button key={i} type="button" onClick={() => setActive(i)}
                      className={cn(
                        "h-14 w-14 shrink-0 rounded-lg overflow-hidden border-2 transition",
                        i === active ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                      )}>
                      <img src={u} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Info ──────────────────────────────────────────────── */}
            <div className="flex flex-col p-5 md:p-6">
              <div className="flex items-start justify-between gap-3 pr-6">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{costume.costume_code}</p>
                  <h2 className="text-xl font-semibold leading-tight mt-0.5">{costume.name}</h2>
                </div>
                <Badge variant={STATUS_VARIANT[costume.status]} className="capitalize shrink-0">{costume.status}</Badge>
              </div>

              {/* Pricing */}
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{formatCurrency(costume.daily_rate)}</span>
                    <span className="text-sm text-muted-foreground">/ day</span>
                  </div>
                  {costume.flat_rate != null && (
                    <p className="text-xs text-muted-foreground">or {formatCurrency(costume.flat_rate)} flat</p>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground space-y-0.5">
                  <p>Deposit <span className="text-foreground font-medium">{formatCurrency(costume.security_deposit)}</span></p>
                  <p>Replacement <span className="text-foreground font-medium">{formatCurrency(costume.replacement_value)}</span></p>
                </div>
              </div>

              {/* Availability */}
              <div className="mt-4 flex items-center gap-2 text-sm">
                <span className={cn("h-2 w-2 rounded-full", availableUnits > 0 ? "bg-green-500" : "bg-muted-foreground/40")} />
                <span className="font-medium">{availableUnits}</span>
                <span className="text-muted-foreground">of {totalUnits} units available</span>
              </div>

              {/* Sizes */}
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Sizes</p>
                {totalUnits === 0 ? (
                  <p className="text-sm text-muted-foreground">No units yet — add units to make this rentable.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((s) => {
                      const out = s.available <= 0;
                      return (
                        <div key={s.size || "_one"}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-sm flex items-center gap-2",
                            out && "opacity-50",
                          )}>
                          <span className="font-medium">{sizeLabel(s.size)}</span>
                          <span className={cn("text-xs", out ? "text-muted-foreground" : "text-green-600")}>
                            {s.available}/{s.total}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Spec list */}
              {attrs.length > 0 && (
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t pt-4">
                  {attrs.map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd className="truncate">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {/* Description */}
              {costume.description && (
                <div className="mt-4 border-t pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Description</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{costume.description}</p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-auto pt-5 flex items-center gap-2">
                <Button className="flex-1" onClick={() => setAddOpen(true)} disabled={!rentable}
                  title={!rentable ? "Costume is inactive or has no units" : "Add to bucket"}>
                  <ShoppingCart className="h-4 w-4 mr-2" /> Add to bucket
                </Button>
                {onManageUnits && (
                  <Button variant="outline" size="icon" onClick={() => onManageUnits(costume)} title="Manage units">
                    <Boxes className="h-4 w-4" />
                  </Button>
                )}
                {onEdit && (
                  <Button variant="outline" size="icon" onClick={() => onEdit(costume)} title="Edit costume">
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddToBucketDialog open={addOpen} onOpenChange={setAddOpen} costume={costume} />
    </>
  );
}
