import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Award, Loader2, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GenerateReportButton } from "@/components/management/reports/GenerateReportButton";
import { DataCard, EmptyState } from "@/components/warehouse/master/masterUi";
import { QuoteStatusChip, RfqStatusChip, formatDeadline, formatMoney } from "@/components/sourcing/rfq/rfqStatus";
import { useCompany } from "@/contexts/CompanyContext";
import { useRfqRfpRequest, useRfqRfpRequests } from "@/hooks/useRfqRfp";
import { useAwardRfq } from "@/hooks/useRfqWorkflow";
import { cn } from "@/lib/utils";
import type { SupplierQuote } from "@/types/rfqRfp";

const AWARDABLE_RFQ = ["published", "in_progress", "evaluation"];
const AWARDABLE_QUOTE = ["submitted", "under_evaluation", "shortlisted"];

export default function QuotationComparison() {
  const { selectedCompany } = useCompany();
  const [params, setParams] = useSearchParams();
  const rfqId = params.get("rfq") ?? undefined;
  const { data: rfqs = [] } = useRfqRfpRequests(selectedCompany?.id);
  const { data: rfq, isLoading } = useRfqRfpRequest(rfqId);
  const award = useAwardRfq();
  const [awarding, setAwarding] = useState<SupplierQuote | null>(null);
  const [createPo, setCreatePo] = useState(true);

  const withQuotes = rfqs.filter((r) => (r.quotes ?? []).some((q) => q.status !== "draft"));
  const items = useMemo(() => [...(rfq?.items ?? [])].sort((a, b) => a.line_number - b.line_number), [rfq]);
  const quotes = useMemo(
    () =>
      (rfq?.quotes ?? [])
        .filter((q) => q.status !== "draft")
        .sort((a, b) => Number(a.total_quoted_amount ?? 0) - Number(b.total_quoted_amount ?? 0)),
    [rfq],
  );

  // Price lookup and the lowest price per item.
  const price = (q: SupplierQuote, itemId: string) => q.items?.find((i) => i.rfq_item_id === itemId);
  const lowestByItem = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      const prices = quotes.map((q) => price(q, it.id!)?.unit_price).filter((p): p is number => p != null);
      if (prices.length) m.set(it.id!, Math.min(...prices.map(Number)));
    }
    return m;
  }, [items, quotes]);
  const complete = (q: SupplierQuote) => items.every((it) => price(q, it.id!));
  const lowestComplete = quotes.find(complete)?.id;
  const canAward = !!rfq && AWARDABLE_RFQ.includes(rfq.status);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Quotation Comparison</h1>
          <p className="mt-1 text-sm text-muted-foreground">Compare supplier quotes line by line, then award the RFQ and create the purchase order.</p>
        </div>
        <GenerateReportButton template="SR-QUOTE-CMP-001" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-[var(--shadow-xs)]">
        <Select value={rfqId ?? ""} onValueChange={(v) => setParams({ rfq: v }, { replace: true })}>
          <SelectTrigger className="h-10 w-full rounded-full sm:w-[420px]" aria-label="RFQ to compare">
            <SelectValue placeholder={withQuotes.length ? "Choose an RFQ with quotes" : "No RFQs have quotes yet"} />
          </SelectTrigger>
          <SelectContent>
            {withQuotes.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.request_number} · {r.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {rfq && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <RfqStatusChip status={rfq.status} />
            <span>Quotes due {formatDeadline(rfq.submission_deadline)}</span>
          </div>
        )}
      </div>

      {!rfqId ? (
        <DataCard>
          <EmptyState icon={Scale} title="Choose an RFQ" description="Pick an RFQ above, or open one from RFQ Management and choose “Compare quotes and award”." action={<Button asChild variant="outline" className="rounded-full"><Link to="/sourcing/rfq-management">Go to RFQ Management</Link></Button>} />
        </DataCard>
      ) : isLoading || !rfq ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>
      ) : quotes.length === 0 ? (
        <DataCard>
          <EmptyState icon={Scale} title="No quotes yet" description="Quotes appear here as suppliers submit them in the portal, or when a buyer records one." />
        </DataCard>
      ) : (
        <>
          {/* Supplier summaries */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {quotes.map((q) => {
              const priced = items.filter((it) => price(q, it.id!)).length;
              const days = (q.items ?? []).map((i) => i.delivery_days).filter((d): d is number => d != null);
              return (
                <div
                  key={q.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-[var(--shadow-xs)]",
                    q.status === "awarded" ? "border-emerald-500/50 ring-2 ring-emerald-500/15" : "border-border/60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{q.supplier?.name ?? "Supplier"}</div>
                      <div className="font-mono text-xs text-muted-foreground">{q.quote_number}</div>
                    </div>
                    <QuoteStatusChip status={q.status} />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold tabular-nums tracking-tight">{formatMoney(q.total_quoted_amount, q.currency)}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      {q.id === lowestComplete && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">Lowest complete quote</span>}
                      <span className={cn("rounded-full px-2 py-0.5", priced === items.length ? "bg-muted text-muted-foreground" : "bg-amber-50 text-amber-700")}>
                        {priced} of {items.length} items priced
                      </span>
                    </div>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Delivery</dt><dd>{q.delivery_commitment || (days.length ? `up to ${Math.max(...days)} days` : "—")}</dd>
                    <dt className="text-muted-foreground">Payment</dt><dd>{q.payment_terms || "—"}</dd>
                    <dt className="text-muted-foreground">Valid for</dt><dd>{q.validity_period ? `${q.validity_period} days` : "—"}</dd>
                    <dt className="text-muted-foreground">Warranty</dt><dd>{q.warranty_offered || "—"}</dd>
                  </dl>
                  {q.notes && <p className="text-xs text-muted-foreground">{q.notes}</p>}
                  {canAward && AWARDABLE_QUOTE.includes(q.status) && (
                    <Button className="mt-auto rounded-full" variant={q.id === lowestComplete ? "default" : "outline"} onClick={() => { setCreatePo(true); setAwarding(q); }}>
                      <Award className="mr-2 h-4 w-4" /> Award to this supplier
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Line-by-line matrix */}
          <DataCard footer="Green marks the lowest unit price for each item.">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Item</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    {quotes.map((q) => (
                      <TableHead key={q.id} className="min-w-[150px] text-right">{q.supplier?.name ?? "Supplier"}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>
                        <div className="font-medium">{it.item_name}</div>
                        {it.item_code && <div className="font-mono text-xs text-muted-foreground">{it.item_code}</div>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{Number(it.quantity).toLocaleString()} {it.unit_of_measure}</TableCell>
                      {quotes.map((q) => {
                        const p = price(q, it.id!);
                        const best = p && Number(p.unit_price) === lowestByItem.get(it.id!);
                        return (
                          <TableCell key={q.id} className={cn("text-right", best && "bg-emerald-50/70")}>
                            {p ? (
                              <>
                                <div className={cn("tabular-nums", best && "font-semibold text-emerald-700")}>{formatMoney(p.unit_price, q.currency)}</div>
                                <div className="text-xs text-muted-foreground tabular-nums">
                                  {formatMoney(p.total_price, q.currency)}{p.delivery_days != null ? ` · ${p.delivery_days} d` : ""}
                                </div>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not quoted</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell colSpan={2}>Total</TableCell>
                    {quotes.map((q) => (
                      <TableCell key={q.id} className="whitespace-nowrap text-right tabular-nums">{formatMoney(q.total_quoted_amount, q.currency)}</TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </DataCard>
        </>
      )}

      <AlertDialog open={!!awarding} onOpenChange={(o) => !o && setAwarding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Award to {awarding?.supplier?.name ?? "this supplier"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {formatMoney(awarding?.total_quoted_amount, awarding?.currency)}. The other quotes are marked “not selected” and the RFQ is closed as awarded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-start gap-2 rounded-lg border p-3">
            <Checkbox id="award-po" checked={createPo} onCheckedChange={(v) => setCreatePo(v === true)} />
            <Label htmlFor="award-po" className="font-normal leading-snug">
              Create a draft purchase order with these prices. It then goes through the normal PO approval.
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              disabled={award.isPending}
              onClick={() => awarding && award.mutate({ quoteId: awarding.id, createPo }, { onSettled: () => setAwarding(null) })}
            >
              Award
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
