import { useState } from "react";
import { Loader2, PenLine } from "lucide-react";
import { useSupplierContext } from "@/contexts/SupplierContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuoteEntryDialog } from "@/components/sourcing/rfq/QuoteEntryDialog";
import {
  QuoteStatusChip, RfqStatusChip, deadlineHint, formatDeadline, formatMoney, isOpenForQuotes,
} from "@/components/sourcing/rfq/rfqStatus";
import { usePortalQuotes, usePortalRfqs, type PortalRfq } from "@/hooks/usePortalSourcing";

export default function PortalQuotes() {
  const { activeSupplierId, activeMembership } = useSupplierContext();
  const { data: rfqs = [], isLoading: rfqsLoading } = usePortalRfqs(activeSupplierId);
  const { data: quotes = [], isLoading: quotesLoading } = usePortalQuotes(activeSupplierId);
  const [quoting, setQuoting] = useState<PortalRfq | null>(null);

  const canQuote = !!activeMembership && activeMembership.portal_role !== "viewer";
  const quoteFor = (requestId: string) => quotes.find((q) => q.request_id === requestId) ?? null;
  const beforeDeadline = (d?: string | null) => !d || new Date(d).getTime() > Date.now();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Quotes</h1>
        <p className="text-sm text-muted-foreground">Requests for quotation you're invited to, and the quotes you've sent.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requests for quotation</CardTitle>
          <CardDescription>
            {canQuote ? "Submit your prices before the deadline. You can update a quote until it closes." : "Your portal role can view requests but not submit quotes."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rfqsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : rfqs.length === 0 ? (
            <p className="text-sm text-muted-foreground">You haven't been invited to any requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Quotes due</TableHead>
                    <TableHead>Your quote</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rfqs.map((row) => {
                    const r = row.request;
                    const mine = quoteFor(r.id);
                    const editable = canQuote && isOpenForQuotes(r.status) && beforeDeadline(r.submission_deadline)
                      && (!mine || ["draft", "submitted"].includes(mine.status));
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.title}</div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-mono">{r.request_number}</span> · {r.items?.length ?? 0} item{r.items?.length === 1 ? "" : "s"}
                          </div>
                        </TableCell>
                        <TableCell><RfqStatusChip status={r.status} /></TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div>{formatDeadline(r.submission_deadline)}</div>
                          {isOpenForQuotes(r.status) && <div className="text-xs text-muted-foreground">{deadlineHint(r.submission_deadline)}</div>}
                        </TableCell>
                        <TableCell>
                          {mine ? (
                            <div className="flex flex-col items-start gap-1">
                              <span className="tabular-nums">{formatMoney(mine.total_quoted_amount, mine.currency)}</span>
                              <QuoteStatusChip status={mine.status} />
                            </div>
                          ) : <span className="text-muted-foreground">Not submitted</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {editable && (
                            <Button size="sm" className="rounded-full" variant={mine ? "outline" : "default"} onClick={() => setQuoting(row)}>
                              <PenLine className="mr-1.5 h-4 w-4" /> {mine ? "Update quote" : "Submit quote"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Your quotes</CardTitle></CardHeader>
        <CardContent>
          {quotesLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Valid until</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((q) => {
                    const from = q.submission_date ?? q.created_at;
                    const validUntil = q.validity_period && from ? new Date(new Date(from).getTime() + q.validity_period * 86_400_000) : null;
                    return (
                      <TableRow key={q.id}>
                        <TableCell className="font-mono">{q.quote_number}</TableCell>
                        <TableCell>{q.request ? `${q.request.request_number} · ${q.request.title}` : "—"}</TableCell>
                        <TableCell><QuoteStatusChip status={q.status} /></TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">{formatMoney(q.total_quoted_amount, q.currency)}</TableCell>
                        <TableCell>{validUntil ? validUntil.toLocaleDateString() : "—"}</TableCell>
                        <TableCell>{from ? new Date(from).toLocaleDateString() : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {quotes.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No quotes yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {quoting && activeSupplierId && (
        <QuoteEntryDialog
          open={!!quoting}
          onOpenChange={(o) => !o && setQuoting(null)}
          rfq={{ ...quoting.request, items: quoting.request.items ?? [] }}
          supplierId={activeSupplierId}
          existing={quoteFor(quoting.request.id)}
        />
      )}
    </div>
  );
}
