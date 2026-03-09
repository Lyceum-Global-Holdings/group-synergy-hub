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
  module: string;
  type: string;
  description: string;
  amount: number | null;
  date: string;
  reference: string | null;
  status: string | null;
  created_at: string;
  created_by: string | null;
  user_name: string | null;
  user_email: string | null;
}

export function TransactionsMonitorPanel() {
  const [source, setSource] = useState<TransactionSource>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data: transactions, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-transactions-monitor", source],
    queryFn: async () => {
      const unified: UnifiedTransaction[] = [];
      const userIds = new Set<string>();

      // Bank Transactions
      if (source === "all" || source === "bank") {
        const { data } = await supabase
          .from("bank_transactions")
          .select("id, transaction_type, description, debit_amount, credit_amount, transaction_date, reference_number, is_reconciled, created_at, created_by")
          .order("created_at", { ascending: false })
          .limit(200);
        data?.forEach((t) => {
          if (t.created_by) userIds.add(t.created_by);
          unified.push({
            id: t.id,
            source: "Bank",
            module: "Finance",
            type: t.transaction_type || "—",
            description: t.description || "—",
            amount: (t.debit_amount || 0) - (t.credit_amount || 0),
            date: t.transaction_date,
            reference: t.reference_number,
            status: t.is_reconciled ? "Reconciled" : "Unreconciled",
            created_at: t.created_at || t.transaction_date,
            created_by: t.created_by,
            user_name: null,
            user_email: null,
          });
        });
      }

      // Stock Transactions
      if (source === "all" || source === "stock") {
        const { data } = await supabase
          .from("stock_transactions")
          .select("id, transaction_type, reference_type, reference_id, quantity_change, total_value, notes, created_at, created_by")
          .order("created_at", { ascending: false })
          .limit(200);
        data?.forEach((t) => {
          if (t.created_by) userIds.add(t.created_by);
          unified.push({
            id: t.id,
            source: "Stock",
            module: "Warehouse",
            type: t.transaction_type || "—",
            description: t.notes || `${t.reference_type || ""} / ${t.reference_id || "—"}`,
            amount: t.total_value,
            date: t.created_at,
            reference: t.reference_id,
            status: t.reference_type,
            created_at: t.created_at,
            created_by: t.created_by,
            user_name: null,
            user_email: null,
          });
        });
      }

      // Asset Transactions
      if (source === "all" || source === "asset") {
        const { data } = await supabase
          .from("asset_transactions")
          .select("id, transaction_type, description, amount, transaction_date, reference_number, created_at, created_by")
          .order("created_at", { ascending: false })
          .limit(200);
        data?.forEach((t) => {
          if (t.created_by) userIds.add(t.created_by);
          unified.push({
            id: t.id,
            source: "Asset",
            module: "Assets",
            type: t.transaction_type || "—",
            description: t.description || "—",
            amount: t.amount,
            date: t.transaction_date,
            reference: t.reference_number,
            status: null,
            created_at: t.created_at || t.transaction_date,
            created_by: t.created_by,
            user_name: null,
            user_email: null,
          });
        });
      }

      // Journal Entries
      if (source === "all" || source === "journal") {
        const { data } = await supabase
          .from("journal_entries")
          .select("id, journal_number, description, total_debit, journal_date, status, created_at, created_by")
          .order("created_at", { ascending: false })
          .limit(200);
        data?.forEach((t) => {
          if (t.created_by) userIds.add(t.created_by);
          unified.push({
            id: t.id,
            source: "Journal",
            module: "Finance",
            type: "Entry",
            description: t.description || t.journal_number || "—",
            amount: t.total_debit,
            date: t.journal_date,
            reference: t.journal_number,
            status: t.status,
            created_at: t.created_at || t.journal_date,
            created_by: t.created_by,
            user_name: null,
            user_email: null,
          });
        });
      }

      // Batch-fetch profiles for all user IDs
      const userIdArray = Array.from(userIds);
      if (userIdArray.length > 0) {
        const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
        // Fetch in chunks of 50 to avoid URL length limits
        for (let i = 0; i < userIdArray.length; i += 50) {
          const chunk = userIdArray.slice(i, i + 50);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", chunk);
          profiles?.forEach((p) => profileMap.set(p.id, { full_name: p.full_name, email: p.email }));
        }
        // Attach profile info to transactions
        unified.forEach((t) => {
          if (t.created_by && profileMap.has(t.created_by)) {
            const profile = profileMap.get(t.created_by)!;
            t.user_name = profile.full_name?.split(" ")[0] || null;
            t.user_email = profile.email;
          }
        });
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
      t.source.toLowerCase().includes(term) ||
      t.module.toLowerCase().includes(term) ||
      t.user_name?.toLowerCase().includes(term) ||
      t.user_email?.toLowerCase().includes(term)
    );
  });

  const sourceBadgeVariant = (src: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (src) {
      case "Bank": return "default";
      case "Stock": return "secondary";
      case "Asset": return "outline";
      case "Journal": return "destructive";
      default: return "default";
    }
  };

  const moduleBadgeColor = (mod: string) => {
    switch (mod) {
      case "Finance": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "Warehouse": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      case "Assets": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null || amount === undefined) return "—";
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const colSpan = 9;

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
                <TableHead className="w-[90px]">Module</TableHead>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-[110px]">Amount</TableHead>
                <TableHead className="w-[95px]">Date</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[100px]">User</TableHead>
                <TableHead className="w-[160px]">Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">
                    Loading transactions...
                  </TableCell>
                </TableRow>
              ) : !filtered?.length ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">
                    No transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow key={`${t.source}-${t.id}`}>
                    <TableCell>
                      <Badge variant={sourceBadgeVariant(t.source)}>{t.source}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${moduleBadgeColor(t.module)}`}>
                        {t.module}
                      </span>
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
                    <TableCell>
                      {t.status ? (
                        <Badge variant="outline" className="text-xs">{t.status}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {t.user_name || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]" title={t.user_email || ""}>
                      {t.user_email || "—"}
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
