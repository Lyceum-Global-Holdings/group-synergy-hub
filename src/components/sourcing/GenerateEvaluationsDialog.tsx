import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCompany } from "@/contexts/CompanyContext";
import { useGenerateSupplierEvaluations } from "@/hooks/useSupplierEvaluations";
import { evaluationPeriods } from "@/lib/evaluationPeriods";

/** Evaluate every supplier that delivered in a period, from approved goods receipts. */
export function GenerateEvaluationsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { selectedCompany } = useCompany();
  const generate = useGenerateSupplierEvaluations();
  const periods = evaluationPeriods();
  const [from, setFrom] = useState(periods[0].from);
  const [to, setTo] = useState(periods[0].to);

  useEffect(() => {
    if (open) {
      setFrom(periods[0].from);
      setTo(periods[0].to);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const valid = !!selectedCompany?.id && !!from && !!to && from <= to;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany?.id) return;
    await generate.mutateAsync({ companyId: selectedCompany.id, from, to });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Evaluate all suppliers</DialogTitle>
          <DialogDescription>
            Creates one evaluation for each supplier that delivered to {selectedCompany?.name ?? "the selected company"} in the period,
            scored from its approved goods receipts. Draft evaluations for the same period are topped up, not duplicated.
          </DialogDescription>
        </DialogHeader>
        {!selectedCompany?.id ? (
          <p className="text-sm text-muted-foreground">Choose a company at the top of the page first.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {periods.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  size="sm"
                  variant={p.from === from && p.to === to ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => { setFrom(p.from); setTo(p.to); }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="eval-from">From</Label>
                <Input id="eval-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eval-to">To</Label>
                <Input id="eval-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={!valid || generate.isPending}>
                {generate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Evaluate
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
