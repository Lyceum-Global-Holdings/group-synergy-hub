import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ArrowUpRight, ArrowDownLeft, Check, Clock } from "lucide-react";

export function BankTransactionList() {
  const { selectedCompany } = useCompany();

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["bank-transactions", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_transactions")
        .select(`
          *,
          bank_accounts (
            bank_name,
            account_name
          )
        `)
        .eq("company_id", selectedCompany?.id)
        .order("transaction_date", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Reconciled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              transactions?.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell>{format(new Date(txn.transaction_date), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{(txn.bank_accounts as any)?.bank_name}</div>
                      <div className="text-muted-foreground">{(txn.bank_accounts as any)?.account_name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {Number(txn.debit_amount) > 0 ? (
                        <ArrowUpRight className="h-4 w-4 text-destructive" />
                      ) : (
                        <ArrowDownLeft className="h-4 w-4 text-green-500" />
                      )}
                      <span className="capitalize">{txn.transaction_type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{txn.description}</TableCell>
                  <TableCell className="font-mono text-sm">{txn.reference_number}</TableCell>
                  <TableCell className="text-right text-destructive">
                    {Number(txn.debit_amount) > 0 ? formatCurrency(txn.debit_amount) : "-"}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {Number(txn.credit_amount) > 0 ? formatCurrency(txn.credit_amount) : "-"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(txn.running_balance || 0)}
                  </TableCell>
                  <TableCell>
                    {txn.is_reconciled ? (
                      <Badge variant="outline" className="gap-1">
                        <Check className="h-3 w-3" /> Reconciled
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="h-3 w-3" /> Pending
                      </Badge>
                    )}
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
