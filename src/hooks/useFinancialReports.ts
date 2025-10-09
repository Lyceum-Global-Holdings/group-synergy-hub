import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import type { TrialBalanceRow } from "@/types/generalLedger";

export const useFinancialReports = () => {
  const { selectedCompany } = useCompany();

  const getTrialBalance = (asOfDate: string) => {
    return useQuery({
      queryKey: ["trial-balance", selectedCompany?.id, asOfDate],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("get_trial_balance", {
          p_as_of_date: asOfDate,
          p_company_id: selectedCompany?.id,
        });

        if (error) throw error;
        return data as TrialBalanceRow[];
      },
      enabled: !!selectedCompany?.id && !!asOfDate,
    });
  };

  const getProfitLoss = (startDate: string, endDate: string) => {
    return useQuery({
      queryKey: ["profit-loss", selectedCompany?.id, startDate, endDate],
      queryFn: async () => {
        // Get all revenue and expense accounts
        const { data: accounts, error } = await supabase
          .from("chart_of_accounts")
          .select(`
            *,
            lines:journal_entry_lines(
              debit_amount,
              credit_amount,
              journal_entry:journal_entries!inner(
                journal_date,
                status
              )
            )
          `)
          .eq("company_id", selectedCompany?.id)
          .in("account_type", ["revenue", "expense"])
          .gte("lines.journal_entry.journal_date", startDate)
          .lte("lines.journal_entry.journal_date", endDate)
          .eq("lines.journal_entry.status", "posted");

        if (error) throw error;

        // Calculate totals
        const revenues = accounts
          ?.filter(a => a.account_type === 'revenue')
          .reduce((sum, acc: any) => {
            const total = acc.lines?.reduce((s: number, l: any) => 
              s + (l.credit_amount - l.debit_amount), 0) || 0;
            return sum + total;
          }, 0) || 0;

        const expenses = accounts
          ?.filter(a => a.account_type === 'expense')
          .reduce((sum, acc: any) => {
            const total = acc.lines?.reduce((s: number, l: any) => 
              s + (l.debit_amount - l.credit_amount), 0) || 0;
            return sum + total;
          }, 0) || 0;

        return {
          revenues,
          expenses,
          netIncome: revenues - expenses,
          accounts,
        };
      },
      enabled: !!selectedCompany?.id && !!startDate && !!endDate,
    });
  };

  return {
    getTrialBalance,
    getProfitLoss,
  };
};
