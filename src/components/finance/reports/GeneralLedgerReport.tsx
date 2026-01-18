import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export function GeneralLedgerReport() {
  const { selectedCompany } = useCompany();
  const [selectedAccount, setSelectedAccount] = useState<string>("all");

  const { data: accounts } = useQuery({
    queryKey: ["chart-of-accounts", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, account_code, account_name")
        .eq("company_id", selectedCompany?.id)
        .eq("is_active", true)
        .order("account_code");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: entries, isLoading } = useQuery({
    queryKey: ["gl-entries", selectedCompany?.id, selectedAccount],
    queryFn: async () => {
      let query = supabase
        .from("journal_entry_lines")
        .select(`
          id,
          debit_amount,
          credit_amount,
          description,
          journal_entries (
            entry_number,
            entry_date,
            description
          ),
          chart_of_accounts (
            account_code,
            account_name
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (selectedAccount && selectedAccount !== "all") {
        query = query.eq("account_id", selectedAccount);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  let runningBalance = 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>General Ledger Report</CardTitle>
        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="All Accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accounts?.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.account_code} - {account.account_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Entry #</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No journal entries found
                </TableCell>
              </TableRow>
            ) : (
              entries?.map((entry) => {
                const debit = Number(entry.debit_amount) || 0;
                const credit = Number(entry.credit_amount) || 0;
                runningBalance += debit - credit;
                
                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {(entry.journal_entries as any)?.entry_date 
                        ? format(new Date((entry.journal_entries as any).entry_date), "dd MMM yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell className="font-mono">
                      {(entry.journal_entries as any)?.entry_number}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="text-muted-foreground">{(entry.chart_of_accounts as any)?.account_code}</span>
                        <span className="ml-2">{(entry.chart_of_accounts as any)?.account_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {entry.description || (entry.journal_entries as any)?.description}
                    </TableCell>
                    <TableCell className="text-right">
                      {debit > 0 ? formatCurrency(debit) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {credit > 0 ? formatCurrency(credit) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(runningBalance)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
