import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarClock, History, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useContract, useContractEvents } from "@/hooks/useContracts";
import { useContractMutations } from "@/hooks/useContractMutations";
import { RENEWAL_POLICIES, nextExpiry, renewalPolicyOf, renewalSummary, renewalTermOf } from "@/lib/contractRenewal";
import { cn } from "@/lib/utils";
import type { Contract, ContractEvent } from "@/types/contracts";

const pretty = (d: string | null) => (d ? format(parseISO(d), "d MMM yyyy") : "");

const EVENT_TEXT: Record<ContractEvent["event"], (e: ContractEvent) => string> = {
  activated: () => "Became active on its effective date",
  renewal_due: (e) => `Owner reminded: expires ${pretty(e.old_expiry)}`,
  auto_renewed: (e) => `Renewed automatically to ${pretty(e.new_expiry)}`,
  renewed: (e) => `Renewed to ${pretty(e.new_expiry)}`,
  expired: (e) => `Expired${e.old_expiry ? ` on ${pretty(e.old_expiry)}` : ""}`,
};

const TONE = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
  soon: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  overdue: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
  muted: "border-border bg-muted/40",
};

export function ContractRenewalPanel({ contract: initial }: { contract: Contract }) {
  // Re-read so a renewal made here shows straight away.
  const { data: fresh } = useContract(initial.id);
  const contract = fresh ?? initial;
  const { data: events = [], isLoading } = useContractEvents(contract.id);
  const [renewOpen, setRenewOpen] = useState(false);
  const summary = renewalSummary(contract);
  const policy = RENEWAL_POLICIES.find((p) => p.value === renewalPolicyOf(contract));
  const term = renewalTermOf(contract);
  const canRenew = !!contract.expiry_date && ["approved", "active", "renewed", "expired"].includes(contract.status);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-muted-foreground" /> Expiry and renewal
        </CardTitle>
        {canRenew && (
          <Button size="sm" variant="outline" onClick={() => setRenewOpen(true)}>
            <RefreshCw className="mr-2 h-4 w-4" /> Renew
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={cn("rounded-lg border px-4 py-3", TONE[summary.tone])}>
          <p className="font-medium">{summary.label}</p>
          {summary.detail && <p className="text-sm opacity-80">{summary.detail}</p>}
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div><dt className="text-muted-foreground">When it expires</dt><dd>{policy?.label}</dd></div>
          <div><dt className="text-muted-foreground">Term</dt><dd>{term ? `${term} month${term === 1 ? "" : "s"}` : "—"}</dd></div>
          <div>
            <dt className="text-muted-foreground">Renewed</dt>
            <dd>{contract.renewal_count ?? 0}{contract.max_renewal_count != null ? ` of ${contract.max_renewal_count}` : ""} time{(contract.renewal_count ?? 0) === 1 ? "" : "s"}</dd>
          </div>
          <div><dt className="text-muted-foreground">Reminder</dt><dd>{contract.renewal_notice_days ?? 30} days before</dd></div>
        </dl>

        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-medium"><History className="h-4 w-4 text-muted-foreground" /> History</h4>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has happened to this contract's dates yet.</p>
          ) : (
            <ol className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{format(new Date(e.created_at), "d MMM yyyy")}</span>
                  <span>
                    {EVENT_TEXT[e.event]?.(e) ?? e.event}
                    {e.note && <span className="block text-muted-foreground">{e.note}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </CardContent>
      {canRenew && <RenewContractDialog contract={contract} open={renewOpen} onOpenChange={setRenewOpen} />}
    </Card>
  );
}

export function RenewContractDialog({
  contract,
  open,
  onOpenChange,
}: {
  contract: Contract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { renewContract } = useContractMutations();
  const today = format(new Date(), "yyyy-MM-dd");
  const suggested = () => {
    if (!contract.expiry_date) return "";
    let next = nextExpiry(contract.expiry_date, renewalTermOf(contract) ?? 12);
    // An expired contract renewed late still needs a date in the future.
    while (next < today) next = nextExpiry(next, renewalTermOf(contract) ?? 12);
    return next;
  };
  const [newExpiry, setNewExpiry] = useState(suggested);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setNewExpiry(suggested());
      setNote("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contract.id, contract.expiry_date]);

  const valid = !!newExpiry && !!contract.expiry_date && newExpiry > contract.expiry_date && newExpiry >= today;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await renewContract.mutateAsync({ id: contract.id, newExpiry, note });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renew {contract.contract_number}</DialogTitle>
          <DialogDescription>
            {contract.expiry_date ? `Currently runs to ${pretty(contract.expiry_date)}. ` : ""}
            The contract becomes active again and the owner is reminded before the new date.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="renew-expiry">New expiry date</Label>
            <Input id="renew-expiry" type="date" value={newExpiry} min={contract.expiry_date ?? undefined} onChange={(e) => setNewExpiry(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="renew-note">Note (optional)</Label>
            <Textarea id="renew-note" rows={2} placeholder="e.g. signed renewal letter on file" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!valid || renewContract.isPending}>
              {renewContract.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Renew
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
