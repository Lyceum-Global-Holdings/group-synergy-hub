import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ArrowUpRight, ArrowDownRight, RefreshCw, Trash2 } from "lucide-react";

export function AssetTransactionList() {
  const { selectedCompany } = useCompany();

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["asset-transactions", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_transactions")
        .select(`
          *,
          asset_master (
            asset_name
          )
        `)
        .eq("company_id", selectedCompany?.id)
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  const getTransactionIcon = (type: string | null) => {
    switch (type) {
      case "acquisition":
        return <ArrowDownRight className="h-4 w-4 text-green-500" />;
      case "depreciation":
        return <ArrowUpRight className="h-4 w-4 text-destructive" />;
      case "revaluation":
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case "disposal":
        return <Trash2 className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getTransactionBadge = (type: string | null) => {
    switch (type) {
      case "acquisition":
        return <Badge className="bg-green-500">Acquisition</Badge>;
      case "depreciation":
        return <Badge variant="destructive">Depreciation</Badge>;
      case "revaluation":
        return <Badge className="bg-blue-500">Revaluation</Badge>;
      case "disposal":
        return <Badge variant="outline">Disposal</Badge>;
      case "transfer":
        return <Badge variant="secondary">Transfer</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No asset transactions recorded
                </TableCell>
              </TableRow>
            ) : (
              transactions?.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell>
                    {format(new Date(txn.transaction_date), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {(txn.asset_master as any)?.asset_name}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTransactionIcon(txn.transaction_type)}
                      {getTransactionBadge(txn.transaction_type)}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {txn.reference_number || "-"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {txn.description}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(txn.amount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
