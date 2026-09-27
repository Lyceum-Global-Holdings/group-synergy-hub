import { useState } from "react";
import { AlertTriangle, CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import type { MatchLineItem, MatchResult, PriceCheck, QtyCheck } from "@/hooks/useThreeWayMatch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ThreeWayMatchDetailProps {
  result: MatchResult;
  /** accept = true accepts the invoice for payment; false fails the match. */
  onDecide: (accept: boolean, reason?: string) => void;
  isUpdating: boolean;
}

type Tone = "good" | "warn" | "bad" | "none";

const qtyInfo: Record<QtyCheck, { label: string; tone: Tone }> = {
  match: { label: "Received", tone: "good" },
  over: { label: "More than received", tone: "bad" },
  not_received: { label: "Not received yet", tone: "bad" },
  not_invoiced: { label: "Not on this invoice", tone: "none" },
  extra: { label: "Not on the PO", tone: "bad" },
};

const priceInfo: Record<PriceCheck, { label: string; tone: Tone }> = {
  match: { label: "PO price", tone: "good" },
  tolerance: { label: "Within 2%", tone: "warn" },
  under: { label: "Below PO price", tone: "warn" },
  over: { label: "Above PO price", tone: "bad" },
  missing: { label: "—", tone: "none" },
};

const toneIcon: Record<Tone, JSX.Element> = {
  good: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  bad: <XCircle className="h-4 w-4 text-destructive" />,
  none: <MinusCircle className="h-4 w-4 text-muted-foreground" />,
};

const rowTone = (l: MatchLineItem): string => {
  const tones = [qtyInfo[l.qtyCheck]?.tone, priceInfo[l.priceCheck]?.tone];
  if (tones.includes("bad")) return "bg-red-50 dark:bg-red-950/20";
  if (tones.includes("warn")) return "bg-amber-50 dark:bg-amber-950/20";
  if (l.qtyCheck === "not_invoiced") return "bg-muted/40";
  return "";
};

function Check({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
      {toneIcon[tone]} {label}
    </span>
  );
}

const num = (v: number | null, digits = 2) =>
  v === null || v === undefined ? "—" : v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits });

export default function ThreeWayMatchDetail({ result, onDecide, isUpdating }: ThreeWayMatchDetailProps) {
  const [reason, setReason] = useState("");
  const money = (v: number) => `${result.currency} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const differences = result.computedStatus !== "matched";
  const acceptNeedsReason = differences;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Purchase order</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{money(result.poAmount)}</div>
            <p className="text-xs text-muted-foreground">{result.poNumber} · {result.supplierName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Accepted on receipts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{money(result.receivedAmount)}</div>
            <p className="text-xs text-muted-foreground">{result.grnNumbers ?? "No approved goods receipt yet"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{money(result.invoiceAmount)}</div>
            <p className="text-xs text-muted-foreground">{result.invoiceNumber} · {result.invoiceDate}</p>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Ordered</TableHead>
              <TableHead className="text-right">Accepted</TableHead>
              <TableHead className="text-right">Billed earlier</TableHead>
              <TableHead className="text-right">This invoice</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead className="text-right">PO price</TableHead>
              <TableHead className="text-right">Invoice price</TableHead>
              <TableHead>Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.lineItems.map((l, i) => (
              <TableRow key={l.poItemId ?? `extra-${i}`} className={rowTone(l)}>
                <TableCell>
                  <div className="font-medium">{l.itemName}</div>
                  {l.itemCode && <div className="text-xs text-muted-foreground">{l.itemCode}</div>}
                </TableCell>
                <TableCell className="text-right">{num(l.poQty)} {l.unitOfMeasure ?? ""}</TableCell>
                <TableCell className="text-right">{num(l.receivedQty)}</TableCell>
                <TableCell className="text-right">{num(l.invoicedBefore)}</TableCell>
                <TableCell className="text-right font-medium">{num(l.invoiceQty)}</TableCell>
                <TableCell><Check {...(qtyInfo[l.qtyCheck] ?? qtyInfo.not_invoiced)} /></TableCell>
                <TableCell className="text-right">{num(l.poUnitPrice, 4)}</TableCell>
                <TableCell className="text-right">{num(l.invoiceUnitPrice, 4)}</TableCell>
                <TableCell><Check {...(priceInfo[l.priceCheck] ?? priceInfo.missing)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {result.decided ? (
        <Card>
          <CardContent className="space-y-1 pt-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">Decided by finance:</span>
              <Badge variant={result.status === "failed" ? "destructive" : "default"}>
                {result.status === "failed" ? "Failed" : "Accepted"}
              </Badge>
            </div>
            {result.notes && <p className="text-muted-foreground">{result.notes}</p>}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Finance decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {result.computedStatus === "matched"
                ? "Everything billed was received and is priced as ordered."
                : result.computedStatus === "pending"
                  ? "Goods haven't been received against this invoice yet. Wait for the goods receipt, or give a reason to accept it anyway."
                  : "The invoice doesn't agree with the order and receipts. Accepting it needs a reason; otherwise fail it and ask the supplier for a corrected invoice or credit note."}
            </p>
            <div className="space-y-1">
              <Label htmlFor="match-reason">Reason {acceptNeedsReason ? "(required)" : "(required to fail)"}</Label>
              <Textarea id="match-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder={acceptNeedsReason ? "e.g. credit note agreed for the difference" : "Why is this invoice refused?"} />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="destructive" onClick={() => onDecide(false, reason.trim())} disabled={isUpdating || !reason.trim()}>
                <XCircle className="mr-2 h-4 w-4" /> Fail match
              </Button>
              <Button onClick={() => onDecide(true, reason.trim() || undefined)} disabled={isUpdating || (acceptNeedsReason && !reason.trim())}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> {differences ? "Accept with differences" : "Accept"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
