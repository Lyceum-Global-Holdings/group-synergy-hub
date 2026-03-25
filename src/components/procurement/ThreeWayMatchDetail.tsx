import { MatchResult } from "@/hooks/useThreeWayMatch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface ThreeWayMatchDetailProps {
  result: MatchResult;
  onApprove: (id: string) => void;
  onFlagException: (id: string) => void;
  onReject: (id: string) => void;
  isUpdating: boolean;
}

const statusIcon = {
  match: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  tolerance: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  mismatch: <XCircle className="h-4 w-4 text-destructive" />,
  missing: <MinusCircle className="h-4 w-4 text-muted-foreground" />,
};

const statusBg = {
  match: "bg-green-50 dark:bg-green-950/20",
  tolerance: "bg-amber-50 dark:bg-amber-950/20",
  mismatch: "bg-red-50 dark:bg-red-950/20",
  missing: "bg-muted/50",
};

function formatCurrency(val: number | null) {
  if (val === null || val === undefined) return "—";
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVariance(val: number | null) {
  if (val === null) return "—";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ThreeWayMatchDetail({
  result,
  onApprove,
  onFlagException,
  onReject,
  isUpdating,
}: ThreeWayMatchDetailProps) {
  const [notes, setNotes] = useState("");

  const matchedLines = result.lineItems.filter(
    (l) => l.qtyMatch === "match" && l.priceMatch === "match"
  ).length;
  const matchPercent = result.lineItems.length > 0
    ? Math.round((matchedLines / result.lineItems.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">PO Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(result.poAmount)}</div>
            <p className="text-xs text-muted-foreground">{result.poNumber}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">GRN Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(result.grnAmount)}</div>
            <p className="text-xs text-muted-foreground">{result.grnNumber ?? "No GRN"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invoice Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(result.invoiceAmount)}</div>
            <p className="text-xs text-muted-foreground">{result.invoiceNumber}</p>
          </CardContent>
        </Card>
      </div>

      {/* Match Percentage */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${matchPercent}%` }}
          />
        </div>
        <span className="text-sm font-medium">{matchPercent}% Match</span>
      </div>

      {/* Line Item Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Item Comparison</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Item</th>
                  <th colSpan={2} className="text-center p-3 font-medium border-l border-r bg-blue-50 dark:bg-blue-950/20">
                    Purchase Order
                  </th>
                  <th colSpan={2} className="text-center p-3 font-medium border-r bg-purple-50 dark:bg-purple-950/20">
                    GRN
                  </th>
                  <th colSpan={2} className="text-center p-3 font-medium border-r bg-orange-50 dark:bg-orange-950/20">
                    Invoice
                  </th>
                  <th colSpan={2} className="text-center p-3 font-medium">Variance</th>
                  <th className="text-center p-3 font-medium">Status</th>
                </tr>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left p-2"></th>
                  <th className="text-right p-2 border-l">Qty</th>
                  <th className="text-right p-2 border-r">Price</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2 border-r">Price</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2 border-r">Price</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-right p-2">Price</th>
                  <th className="text-center p-2"></th>
                </tr>
              </thead>
              <tbody>
                {result.lineItems.map((line, idx) => {
                  const worstStatus = line.qtyMatch === "mismatch" || line.priceMatch === "mismatch"
                    ? "mismatch"
                    : line.qtyMatch === "missing" || line.priceMatch === "missing"
                    ? "missing"
                    : line.priceMatch === "tolerance"
                    ? "tolerance"
                    : "match";

                  return (
                    <tr key={idx} className={`border-b ${statusBg[worstStatus]}`}>
                      <td className="p-3 font-medium">
                        {line.itemName}
                        {line.itemCode && (
                          <span className="block text-xs text-muted-foreground">{line.itemCode}</span>
                        )}
                      </td>
                      <td className="text-right p-3 border-l">{line.poQty}</td>
                      <td className="text-right p-3 border-r">{formatCurrency(line.poUnitPrice)}</td>
                      <td className={`text-right p-3 ${statusBg[classifyGrn(line)]}`}>
                        {line.grnQty ?? "—"}
                      </td>
                      <td className={`text-right p-3 border-r ${statusBg[classifyGrn(line)]}`}>
                        {formatCurrency(line.grnUnitPrice)}
                      </td>
                      <td className={`text-right p-3 ${statusBg[line.qtyMatch]}`}>
                        {line.invoiceQty ?? "—"}
                      </td>
                      <td className={`text-right p-3 border-r ${statusBg[line.priceMatch]}`}>
                        {formatCurrency(line.invoiceUnitPrice)}
                      </td>
                      <td className="text-right p-3">{formatVariance(line.qtyVariance)}</td>
                      <td className="text-right p-3">{formatVariance(line.priceVariance)}</td>
                      <td className="text-center p-3">
                        <div className="flex items-center justify-center gap-1">
                          {statusIcon[line.qtyMatch]}
                          {statusIcon[line.priceMatch]}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Summary Row */}
                <tr className="font-semibold bg-muted/30">
                  <td className="p-3">Total</td>
                  <td className="text-right p-3 border-l">
                    {result.lineItems.reduce((s, l) => s + l.poQty, 0)}
                  </td>
                  <td className="text-right p-3 border-r">{formatCurrency(result.poAmount)}</td>
                  <td className="text-right p-3">
                    {result.lineItems.reduce((s, l) => s + (l.grnQty ?? 0), 0)}
                  </td>
                  <td className="text-right p-3 border-r">{formatCurrency(result.grnAmount)}</td>
                  <td className="text-right p-3">
                    {result.lineItems.reduce((s, l) => s + (l.invoiceQty ?? 0), 0)}
                  </td>
                  <td className="text-right p-3 border-r">{formatCurrency(result.invoiceAmount)}</td>
                  <td colSpan={2} className="text-right p-3">
                    <Badge variant={result.variancePercent === 0 ? "default" : "destructive"}>
                      {result.variancePercent > 0 ? "+" : ""}{result.variancePercent.toFixed(1)}%
                    </Badge>
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Notes + Actions */}
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Notes / Exception Reason</label>
          <Textarea
            placeholder="Add notes for this match review..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            variant="destructive"
            onClick={() => onReject(result.invoiceId)}
            disabled={isUpdating}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Reject
          </Button>
          <Button
            variant="outline"
            onClick={() => onFlagException(result.invoiceId)}
            disabled={isUpdating}
            className="border-amber-500 text-amber-600 hover:bg-amber-50"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Flag Exception
          </Button>
          <Button
            onClick={() => onApprove(result.invoiceId)}
            disabled={isUpdating}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Approve Match
          </Button>
        </div>
      </div>
    </div>
  );
}

function classifyGrn(line: { grnQty: number | null; grnUnitPrice: number | null }): "match" | "missing" {
  return line.grnQty === null ? "missing" : "match";
}
