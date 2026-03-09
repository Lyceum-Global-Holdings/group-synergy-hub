import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Search, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";

type TransactionSource = "all" | "bank" | "stock" | "asset" | "journal";

interface UnifiedTransaction {
  id: string;
  source: string;
  type: string;
  description: string;
  amount: number | null;
  date: string;
  reference: string | null;
  status: string | null;
  created_at: string;
}

export function TransactionsMonitorPanel() {
  const [source, setSource] = useState<TransactionSource>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data: transactions, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-transactions-monitor", source],
    queryFn: async () => {
      const unified: UnifiedTransaction[] = [];

      // Bank Transactions
      if (source === "all" || source === "bank") {
        const { data } = await supabase
          .from("bank_transactions")
          .select("id, transaction_type, description, debit_amount, credit_amount, transaction_date, reference_number, is_reconciled, created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        data?.forEach((t) =>
          unified.push({
            id: t.id,
            source: "Bank",
            type: t.transaction_type || "—",
            description: t.description || "—",
            amount: (t.debit_amount || 0) - (t.credit_amount || 0),
            date: t.transaction_date,
            reference: t.reference_number,
            status: t.is_reconciled ? "Reconciled" : "Unreconciled",
            created_at: t.created_at || t.transaction_date,
          })
        );
      }

      // Stock Transactions
      if (source === "all" || source === "stock") {
        const { data } = await supabase
          .from("stock_transactions")
          .select("id, transaction_type, reference_type, reference_id, quantity_change, total_value, notes, created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        data?.forEach((t) =>
          unified.push({
            id: t.id,
            source: "Stock",
            type: t.transaction_type || "—",
            description: t.notes || `${t.reference_type || ""} / ${t.reference_id || "—"}`,
            amount: t.total_value,
            date: t.created_at,
            reference: t.reference_id,
            status: t.reference_type,
            created_at: t.created_at,
          })
        );
      }

      // Asset Transactions
      if (source === "all" || source === "asset") {
        const { data } = await supabase
          .from("asset_transactions")
          .select("id, transaction_type, description, amount, transaction_date, reference_number, created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        data?.forEach((t) =>
          unified.push({
            id: t.id,
            source: "Asset",
            type: t.transaction_type || "—",
            description: t.description || "—",
            amount: t.amount,
            date: t.transaction_date,
            reference: t.reference_number,
            status: null,
            created_at: t.created_at || t.transaction_date,
          })
        );
      }

      // Journal Entries
      if (source === "all" || source === "journal") {
        const { data } = await supabase
          .from("journal_entries")
          .select("id, journal_number, description, total_debit, journal_date, status, created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        data?.forEach((t) =>
          unified.push({
            id: t.id,
            source: "Journal",
            type: "Entry",
            description: t.description || t.journal_number || "—",
            amount: t.total_debit,
            date: t.journal_date,
            reference: t.journal_number,
            status: t.status,
            created_at: t.created_at || t.journal_date,
          })
        );
      }

      // Sort by created_at
      unified.sort((a, b) => {
        const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return sortOrder === "desc" ? -diff : diff;
      });

      return unified;
    },
    refetchInterval: 30000,
  });

  const filtered = transactions?.filter((t) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.description.toLowerCase().includes(term) ||
      t.type.toLowerCase().includes(term) ||
      t.reference?.toLowerCase().includes(term) ||
      t.source.toLowerCase().includes(term)
    );
  });

  const sourceBadgeVariant = (src: string) => {
    switch (src) {
      case "Bank": return "default";
      case "Stock": return "secondary";
      case "Asset": return "outline";
      case "Journal": return "destructive";
      default: return "default";
    }
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null || amount === undefined) return "—";
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg">Transaction Monitor</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={source} onValueChange={(v) => setSource(v as TransactionSource)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="stock">Stock</SelectItem>
                <SelectItem value="asset">Asset</SelectItem>
                <SelectItem value="journal">Journal</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-[180px]"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
              title={`Sort ${sortOrder === "desc" ? "oldest first" : "newest first"}`}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Showing up to 200 transactions per source. Auto-refreshes every 30s.
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Source</TableHead>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-[120px]">Amount</TableHead>
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead className="w-[120px]">Reference</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading transactions...
                  </TableCell>
                </TableRow>
              ) : !filtered?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow key={`${t.source}-${t.id}`}>
                    <TableCell>
                      <Badge variant={sourceBadgeVariant(t.source)}>{t.source}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium">{t.type}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={t.description}>
                      {t.description}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {formatAmount(t.amount)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.date ? format(new Date(t.date), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-xs truncate max-w-[120px]" title={t.reference || ""}>
                      {t.reference || "—"}
                    </TableCell>
                    <TableCell>
                      {t.status ? (
                        <Badge variant="outline" className="text-xs">{t.status}</Badge>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
