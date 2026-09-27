import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronsUpDown, Loader2, Mail, Scale, Send, Trash2, UserPlus, XCircle, RotateCcw, Lock, PenLine } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRfqRfpRequest } from "@/hooks/useRfqRfp";
import { useOrderableSuppliers } from "@/hooks/useSuppliers";
import { useInviteSuppliers, useRemoveInvitation, useRfqAction, type RfqAction } from "@/hooks/useRfqWorkflow";
import { cn } from "@/lib/utils";
import type { SupplierQuote } from "@/types/rfqRfp";
import { QuoteEntryDialog } from "./QuoteEntryDialog";
import { useRfqPaths } from "./rfqPaths";
import {
  QuoteStatusChip, RfqStatusChip, StatusChip, deadlineHint, formatDeadline, formatMoney, isOpenForQuotes,
} from "./rfqStatus";

const INVITE_STATUS = {
  invited: { label: "Invited", tone: "slate" },
  viewed: { label: "Viewed", tone: "blue" },
  declined: { label: "Declined", tone: "red" },
  submitted: { label: "Quoted", tone: "green" },
} as const;

const CONFIRM: Record<Exclude<RfqAction, "reopen">, { title: string; body: string; action: string }> = {
  publish: {
    title: "Publish this RFQ?",
    body: "Invited suppliers can see it in the supplier portal and are emailed the request. Items can't be changed after publishing.",
    action: "Publish and email suppliers",
  },
  close: {
    title: "Close submissions?",
    body: "Suppliers can no longer submit or change quotes. You can reopen it later if needed.",
    action: "Close submissions",
  },
  cancel: {
    title: "Cancel this RFQ?",
    body: "Suppliers will see it as cancelled and can no longer quote. This can't be undone.",
    action: "Cancel RFQ",
  },
};

export function RfqWorkspaceSheet({ requestId, onOpenChange }: { requestId: string | null; onOpenChange: (open: boolean) => void }) {
  const { data: rfq, isLoading } = useRfqRfpRequest(requestId ?? undefined);
  const { data: suppliers = [] } = useOrderableSuppliers();
  const invite = useInviteSuppliers();
  const removeInvite = useRemoveInvitation();
  const act = useRfqAction();
  const paths = useRfqPaths();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<Exclude<RfqAction, "reopen"> | null>(null);
  const [quoteFor, setQuoteFor] = useState<{ supplierId: string; supplierName: string; existing: SupplierQuote | null } | null>(null);

  const invited = useMemo(() => rfq?.invited_suppliers ?? [], [rfq]);
  const quotes = useMemo(() => rfq?.quotes ?? [], [rfq]);
  const invitedIds = useMemo(() => new Set(invited.map((i) => i.supplier_id)), [invited]);
  const invitable = suppliers.filter((s) => !invitedIds.has(s.id));
  const quoteBySupplier = useMemo(() => new Map(quotes.map((q) => [q.supplier_id, q])), [quotes]);
  const canInvite = !!rfq && ["draft", "published", "in_progress"].includes(rfq.status);
  const open = !!rfq && isOpenForQuotes(rfq.status);

  const runAction = (action: RfqAction) => rfq && act.mutate({ requestId: rfq.id, action });

  return (
    <Sheet open={!!requestId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {isLoading || !rfq ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-6">
            <SheetHeader className="space-y-2 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{rfq.request_number}</span>
                <RfqStatusChip status={rfq.status} />
              </div>
              <SheetTitle className="text-xl">{rfq.title}</SheetTitle>
              <SheetDescription>
                Quotes due {formatDeadline(rfq.submission_deadline)}
                {open && rfq.submission_deadline ? ` · ${deadlineHint(rfq.submission_deadline)}` : ""}
                {rfq.budget_estimate ? ` · budget ${formatMoney(rfq.budget_estimate, rfq.currency)}` : ""}
              </SheetDescription>
            </SheetHeader>

            {/* Next step */}
            <div className="flex flex-wrap gap-2">
              {rfq.status === "draft" && (
                <Button className="rounded-full" onClick={() => setConfirm("publish")} disabled={act.isPending}>
                  <Send className="mr-2 h-4 w-4" /> Publish and email suppliers
                </Button>
              )}
              {open && (
                <Button variant="outline" className="rounded-full" onClick={() => setConfirm("close")} disabled={act.isPending}>
                  <Lock className="mr-2 h-4 w-4" /> Close submissions
                </Button>
              )}
              {rfq.status === "evaluation" && (
                <Button variant="outline" className="rounded-full" onClick={() => runAction("reopen")} disabled={act.isPending}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Reopen for quotes
                </Button>
              )}
              {quotes.length > 0 && (
                <Button asChild variant={rfq.status === "evaluation" ? "default" : "outline"} className="rounded-full">
                  <Link to={`${paths.compare}?rfq=${rfq.id}`}>
                    <Scale className="mr-2 h-4 w-4" /> Compare quotes and award
                  </Link>
                </Button>
              )}
              {!["awarded", "closed", "cancelled"].includes(rfq.status) && (
                <Button variant="ghost" className="rounded-full text-destructive hover:text-destructive" onClick={() => setConfirm("cancel")} disabled={act.isPending}>
                  <XCircle className="mr-2 h-4 w-4" /> Cancel RFQ
                </Button>
              )}
            </div>

            {/* Items */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Items ({rfq.items?.length ?? 0})</h3>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Estimate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...(rfq.items ?? [])].sort((a, b) => a.line_number - b.line_number).map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="text-muted-foreground">{it.line_number}</TableCell>
                        <TableCell>
                          <div className="font-medium">{it.item_name}</div>
                          {it.item_code && <div className="font-mono text-xs text-muted-foreground">{it.item_code}</div>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">{Number(it.quantity).toLocaleString()} {it.unit_of_measure}</TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                          {it.estimated_unit_price ? formatMoney(it.estimated_unit_price, rfq.currency) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            {/* Suppliers */}
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Invited suppliers ({invited.length})</h3>
                {canInvite && (
                  <div className="flex items-center gap-2">
                    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="rounded-full">
                          {picked.length ? `${picked.length} selected` : "Choose suppliers"}
                          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 opacity-60" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0" align="end">
                        <Command>
                          <CommandInput placeholder="Search approved suppliers…" />
                          <CommandList>
                            <CommandEmpty>No other approved suppliers.</CommandEmpty>
                            <CommandGroup>
                              {invitable.map((s) => {
                                const on = picked.includes(s.id);
                                return (
                                  <CommandItem
                                    key={s.id}
                                    value={`${s.name} ${s.id}`}
                                    onSelect={() => setPicked((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", on ? "opacity-100" : "opacity-0")} />
                                    <span className="truncate">{s.name}</span>
                                    {s.watchlisted && <span className="ml-auto text-xs text-amber-600">watchlist</span>}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button
                      size="sm"
                      className="rounded-full"
                      disabled={picked.length === 0 || invite.isPending}
                      onClick={() => invite.mutate({ requestId: rfq.id, supplierIds: picked }, { onSuccess: () => { setPicked([]); setPickerOpen(false); } })}
                    >
                      <UserPlus className="mr-1.5 h-4 w-4" /> Invite
                    </Button>
                  </div>
                )}
              </div>
              {invited.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No suppliers invited yet. Invite at least one before publishing.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Quote</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invited.map((inv) => {
                        const quote = quoteBySupplier.get(inv.supplier_id) ?? null;
                        const name = inv.supplier?.name ?? "Supplier";
                        return (
                          <TableRow key={inv.id}>
                            <TableCell>
                              <div className="font-medium">{name}</div>
                              {inv.supplier?.email && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{inv.supplier.email}</div>
                              )}
                            </TableCell>
                            <TableCell><StatusChip {...(INVITE_STATUS[inv.invitation_status] ?? INVITE_STATUS.invited)} /></TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              {quote ? (
                                <div className="flex flex-col items-end gap-1">
                                  <span className="tabular-nums">{formatMoney(quote.total_quoted_amount, quote.currency)}</span>
                                  <QuoteStatusChip status={quote.status} />
                                </div>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {open && (!quote || ["draft", "submitted"].includes(quote.status)) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title={quote ? "Update this supplier's quote" : "Record a quote received from this supplier"}
                                    aria-label={`Record quote for ${name}`}
                                    onClick={() => setQuoteFor({ supplierId: inv.supplier_id, supplierName: name, existing: quote })}
                                  >
                                    <PenLine className="h-4 w-4" />
                                  </Button>
                                )}
                                {canInvite && !quote && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:text-destructive"
                                    title="Remove invitation"
                                    aria-label={`Remove ${name}`}
                                    onClick={() => removeInvite.mutate({ requestId: rfq.id, supplierId: inv.supplier_id })}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </div>
        )}

        <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
          <AlertDialogContent>
            {confirm && (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>{CONFIRM[confirm].title}</AlertDialogTitle>
                  <AlertDialogDescription>{CONFIRM[confirm].body}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Back</AlertDialogCancel>
                  <AlertDialogAction
                    className={confirm === "cancel" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
                    onClick={() => { runAction(confirm); setConfirm(null); }}
                  >
                    {CONFIRM[confirm].action}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            )}
          </AlertDialogContent>
        </AlertDialog>

        {rfq && quoteFor && (
          <QuoteEntryDialog
            open={!!quoteFor}
            onOpenChange={(o) => !o && setQuoteFor(null)}
            rfq={{ ...rfq, items: rfq.items ?? [] }}
            supplierId={quoteFor.supplierId}
            supplierName={quoteFor.supplierName}
            existing={quoteFor.existing}
            onBehalf
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
