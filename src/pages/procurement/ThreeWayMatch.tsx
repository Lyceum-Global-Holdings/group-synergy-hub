import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  XCircle,
  Loader2,
  Zap,
  Eye,
} from "lucide-react";
import { useState } from "react";
import { useThreeWayMatch, MatchResult, MatchStatus } from "@/hooks/useThreeWayMatch";
import ThreeWayMatchDetail from "@/components/procurement/ThreeWayMatchDetail";

function statusBadge(status: MatchStatus) {
  const map: Record<MatchStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "secondary", label: "Pending" },
    matched: { variant: "default", label: "Matched" },
    exception: { variant: "outline", label: "Exception" },
    failed: { variant: "destructive", label: "Failed" },
  };
  const { variant, label } = map[status] ?? map.pending;
  return <Badge variant={variant}>{label}</Badge>;
}

function formatCurrency(val: number | null) {
  if (val === null || val === undefined) return "—";
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MatchTable({
  results,
  onView,
}: {
  results: MatchResult[];
  onView: (r: MatchResult) => void;
}) {
  if (!results.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No invoices in this category</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>PO #</TableHead>
            <TableHead>GRN #</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead className="text-right">PO Amount</TableHead>
            <TableHead className="text-right">GRN Amount</TableHead>
            <TableHead className="text-right">Invoice Amount</TableHead>
            <TableHead className="text-right">Variance</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((r) => (
            <TableRow key={r.invoiceId} className="cursor-pointer hover:bg-muted/50">
              <TableCell className="font-medium">{r.invoiceNumber}</TableCell>
              <TableCell>{r.poNumber}</TableCell>
              <TableCell>{r.grnNumber ?? "—"}</TableCell>
              <TableCell>{r.supplierName}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.poAmount)}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.grnAmount)}</TableCell>
              <TableCell className="text-right">{formatCurrency(r.invoiceAmount)}</TableCell>
              <TableCell className="text-right">
                <span className={r.variancePercent === 0 ? "text-green-600" : "text-destructive"}>
                  {r.variancePercent > 0 ? "+" : ""}{r.variancePercent.toFixed(1)}%
                </span>
              </TableCell>
              <TableCell>{statusBadge(r.status)}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => onView(r)}>
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ThreeWayMatch() {
  const {
    matchResults,
    isLoading,
    stats,
    statsLoading,
    approveMatch,
    flagException,
    rejectMatch,
    autoMatch,
    isUpdating,
  } = useThreeWayMatch();

  const [selectedResult, setSelectedResult] = useState<MatchResult | null>(null);

  const filterByStatus = (status: MatchStatus) =>
    matchResults.filter((r) => r.status === status);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">3-Way Match</h1>
          <p className="text-muted-foreground">
            Match Purchase Orders, Goods Receipts, and Invoices
          </p>
        </div>
        <Button onClick={autoMatch} disabled={isUpdating}>
          <Zap className="h-4 w-4 mr-2" />
          Auto-Match All
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Match</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats.pending}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting verification</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Matched</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats.matched}
            </div>
            <p className="text-xs text-muted-foreground">Successfully matched</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">Exceptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats.exception}
            </div>
            <p className="text-xs text-muted-foreground">Requires review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {statsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats.failed}
            </div>
            <p className="text-xs text-muted-foreground">Match failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Tabs */}
      {!isLoading && (
        <Tabs defaultValue="pending" className="w-full">
          <TabsList>
            <TabsTrigger value="pending">
              <FileCheck className="h-4 w-4 mr-2" />
              Pending ({filterByStatus("pending").length})
            </TabsTrigger>
            <TabsTrigger value="matched">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Matched ({filterByStatus("matched").length})
            </TabsTrigger>
            <TabsTrigger value="exceptions">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Exceptions ({filterByStatus("exception").length})
            </TabsTrigger>
            <TabsTrigger value="failed">
              <XCircle className="h-4 w-4 mr-2" />
              Failed ({filterByStatus("failed").length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Pending Matches</CardTitle>
                <CardDescription>
                  Invoices awaiting 3-way match verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MatchTable results={filterByStatus("pending")} onView={setSelectedResult} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="matched" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Successfully Matched</CardTitle>
                <CardDescription>
                  Invoices that passed 3-way match verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MatchTable results={filterByStatus("matched")} onView={setSelectedResult} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exceptions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Match Exceptions</CardTitle>
                <CardDescription>
                  Invoices with discrepancies requiring manual review
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MatchTable results={filterByStatus("exception")} onView={setSelectedResult} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="failed" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Failed Matches</CardTitle>
                <CardDescription>
                  Invoices that failed 3-way match verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MatchTable results={filterByStatus("failed")} onView={setSelectedResult} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedResult} onOpenChange={() => setSelectedResult(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              3-Way Match Detail — {selectedResult?.invoiceNumber}
            </DialogTitle>
          </DialogHeader>
          {selectedResult && (
            <ThreeWayMatchDetail
              result={selectedResult}
              onApprove={(id) => { approveMatch(id); setSelectedResult(null); }}
              onFlagException={(id) => { flagException(id); setSelectedResult(null); }}
              onReject={(id) => { rejectMatch(id); setSelectedResult(null); }}
              isUpdating={isUpdating}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
