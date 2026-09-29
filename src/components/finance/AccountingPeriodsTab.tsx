import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAccountingPeriods, useStockLedger } from "@/hooks/useAccountingPeriods";
import { formatCurrency } from "@/lib/utils";
import type { AccountingPeriod, FiscalYear } from "@/types/generalLedger";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = { open: "default", closed: "secondary", locked: "outline" };

const firstOfNextMonth = () => {
  const d = new Date();
  return format(new Date(d.getFullYear(), d.getMonth() + 1, 1), "yyyy-MM-dd");
};
const dayAfter = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return format(d, "yyyy-MM-dd");
};

/** Warehouse movements posting to the ledger: what is waiting, and why. */
export function StockLedgerCard() {
  const { status, post } = useStockLedger();
  const s = status.data;
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Stock to ledger</h3>
          <p className="text-sm text-muted-foreground">
            Goods receipts, material issues and returns, production issues and stock adjustments post automatically every hour.
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={!s?.configured || post.isPending} onClick={() => post.mutate()}>
          {post.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Post now
        </Button>
      </div>
      {!s ? null : !s.configured ? (
        <p className="text-sm">Not set up: choose the inventory accounts and the posting start date in GL Settings › Posting accounts.</p>
      ) : (
        <div className="text-sm space-y-1">
          <p>
            Posting from {s.start_date ? format(new Date(s.start_date), "d MMM yyyy") : "—"} ·{" "}
            {s.pending} movement(s) waiting ({formatCurrency(Number(s.pending_value))}) ·{" "}
            last posted {s.last_posted_at ? format(new Date(s.last_posted_at), "d MMM, HH:mm") : "never"}
          </p>
          {s.no_cost_30d > 0 && (
            <p className="text-muted-foreground">{s.no_cost_30d} movement(s) in the last 30 days had no cost on record and weren't posted.</p>
          )}
          {s.problems.length > 0 && (
            <ul className="list-disc pl-5 text-destructive">
              {s.problems.slice(0, 5).map((p) => <li key={`${p.document}-${p.problem}`}>{p.document}: {p.problem}</li>)}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

export function AccountingPeriodsTab() {
  const { periods, fiscalYears, isLoading, isPending, openFiscalYear, closePeriod, reopenPeriod, closeFiscalYear } = useAccountingPeriods();
  const [newYearOpen, setNewYearOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [yearName, setYearName] = useState("");
  const [confirmClose, setConfirmClose] = useState<AccountingPeriod | null>(null);
  const [reopening, setReopening] = useState<AccountingPeriod | null>(null);
  const [reason, setReason] = useState("");
  const [closingYear, setClosingYear] = useState<FiscalYear | null>(null);

  // A new year follows on from the last one.
  const lastEnd = useMemo(() => (fiscalYears ?? []).reduce<string | null>((m, y) => (!m || y.end_date > m ? y.end_date : m), null), [fiscalYears]);
  const openPeriods = (periods ?? []).filter((p) => p.status === "open");
  const nextToClose = [...openPeriods].sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  const closedPeriods = (periods ?? []).filter((p) => p.status === "closed");
  const lastClosed = [...closedPeriods].sort((a, b) => b.start_date.localeCompare(a.start_date))[0];

  const startNewYear = () => {
    setStartDate(lastEnd ? dayAfter(lastEnd) : firstOfNextMonth());
    setYearName("");
    setNewYearOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Accounting Periods</h2>
          <p className="text-muted-foreground mt-1">
            Journals are tied to the period of their date. Closed periods refuse new postings; close them in order once their drafts
            are posted and their stock is in the ledger.
          </p>
        </div>
        <Button size="sm" onClick={startNewYear}>
          <Plus className="h-4 w-4 mr-2" />
          New Fiscal Year
        </Button>
      </div>

      <StockLedgerCard />

      {/* Fiscal Years */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Fiscal Years</h3>
        {(fiscalYears ?? []).length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground">No fiscal year yet. Until one is opened, journals post on any date.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fiscalYears?.map((year) => {
            const yearPeriods = (periods ?? []).filter((p) => p.start_date >= year.start_date && p.end_date <= year.end_date);
            const allClosed = yearPeriods.length > 0 && yearPeriods.every((p) => p.status !== "open");
            return (
              <Card key={year.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{year.year_name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(year.start_date), "MMM dd, yyyy")} - {format(new Date(year.end_date), "MMM dd, yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {yearPeriods.filter((p) => p.status !== "open").length} of {yearPeriods.length} periods closed
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      {year.is_current && <Badge className="bg-green-100 text-green-800">Current</Badge>}
                      <Badge variant={STATUS_VARIANT[year.status] ?? "default"}>{year.status.toUpperCase()}</Badge>
                    </div>
                    {year.status === "open" && allClosed && (
                      <Button size="sm" variant="outline" onClick={() => setClosingYear(year)}>Close year</Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Accounting Periods */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Accounting Periods</h3>
        <Card className="p-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading periods...</div>
          ) : periods && periods.length > 0 ? (
            <div className="space-y-2">
              {periods.map((period) => (
                <div key={period.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                  <div>
                    <div className="font-medium">{period.period_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(period.start_date), "MMM dd")} - {format(new Date(period.end_date), "MMM dd, yyyy")}
                      {period.closed_date && period.status !== "open" && ` · closed ${format(new Date(period.closed_date), "d MMM yyyy")}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[period.status] ?? "default"}>{period.status.toUpperCase()}</Badge>
                    {period.id === nextToClose?.id && (
                      <Button variant="outline" size="sm" onClick={() => setConfirmClose(period)}>Close Period</Button>
                    )}
                    {period.id === lastClosed?.id && (
                      <Button variant="ghost" size="sm" onClick={() => { setReason(""); setReopening(period); }}>Reopen</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No accounting periods found</div>
          )}
        </Card>
      </div>

      <Dialog open={newYearOpen} onOpenChange={setNewYearOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New fiscal year</DialogTitle>
            <DialogDescription>
              Creates twelve monthly periods. {lastEnd ? `It follows on from the last year, so it starts ${format(new Date(dayAfter(lastEnd)), "d MMM yyyy")}.` : "Once a year exists, journals dated outside the years are refused."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="fy-start">Starts on *</Label>
              <Input id="fy-start" type="date" value={startDate} disabled={!!lastEnd} onChange={(e) => setStartDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">The first day of a month.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="fy-name">Name</Label>
              <Input id="fy-name" value={yearName} onChange={(e) => setYearName(e.target.value)} placeholder="e.g. FY 2026/27 (optional)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewYearOpen(false)}>Cancel</Button>
            <Button disabled={!startDate || !startDate.endsWith("-01") || isPending}
              onClick={() => openFiscalYear(startDate, yearName, { onSuccess: () => setNewYearOpen(false) })}>
              Open year
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmClose} onOpenChange={(o) => !o && setConfirmClose(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Close {confirmClose?.period_name}?</DialogTitle>
            <DialogDescription>
              Its stock movements are posted first. Closing is refused while a draft journal or an unposted stock movement is dated in it.
              After closing, nothing can be posted or voided in it unless an admin reopens it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClose(null)}>Cancel</Button>
            <Button disabled={isPending} onClick={() => confirmClose && closePeriod(confirmClose.id, { onSuccess: () => setConfirmClose(null) })}>
              Close period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reopening} onOpenChange={(o) => !o && setReopening(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reopen {reopening?.period_name}</DialogTitle>
            <DialogDescription>Admins only. The reason is kept on the period.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="reopen-reason">Reason *</Label>
            <Textarea id="reopen-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopening(null)}>Cancel</Button>
            <Button disabled={!reason.trim() || isPending}
              onClick={() => reopening && reopenPeriod(reopening.id, reason, { onSuccess: () => setReopening(null) })}>
              Reopen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closingYear} onOpenChange={(o) => !o && setClosingYear(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Close {closingYear?.year_name}?</DialogTitle>
            <DialogDescription>
              Revenue and expense balances of the year are closed to retained earnings in one journal on its last day, and its periods are
              locked for good.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosingYear(null)}>Cancel</Button>
            <Button disabled={isPending} onClick={() => closingYear && closeFiscalYear(closingYear.id, { onSuccess: () => setClosingYear(null) })}>
              Close year
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
