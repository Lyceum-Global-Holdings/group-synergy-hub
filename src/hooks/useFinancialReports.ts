import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import type { TrialBalanceRow } from "@/types/generalLedger";

export interface ProfitLossRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  parent_id: string | null;
  level_depth: number;
  current_period_amount: number;
  comparison_period_amount: number;
  variance_amount: number;
  variance_percent: number;
}

export interface BalanceSheetRow {
  account_id: string | null;
  account_code: string;
  account_name: string;
  account_type: string;
  parent_id: string | null;
  level_depth: number;
  balance: number;
  category: string;
}

export interface CashFlowRow {
  category: string;
  activity_type: string;
  account_name: string;
  amount: number;
  is_subtotal: boolean;
}

export interface AgingBucketRow {
  entity_id: string;
  entity_name: string;
  current_bucket: number;
  bucket_1_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_over_90: number;
  total_outstanding: number;
}

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

  const getProfitLossReport = (
    startDate: string, 
    endDate: string, 
    comparisonStart?: string | null, 
    comparisonEnd?: string | null
  ) => {
    return useQuery({
      queryKey: ["profit-loss-report", selectedCompany?.id, startDate, endDate, comparisonStart, comparisonEnd],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("get_profit_loss_report", {
          p_company_id: selectedCompany?.id,
          p_start_date: startDate,
          p_end_date: endDate,
          p_comparison_start: comparisonStart || null,
          p_comparison_end: comparisonEnd || null,
        });

        if (error) throw error;
        return data as ProfitLossRow[];
      },
      enabled: !!selectedCompany?.id && !!startDate && !!endDate,
    });
  };

  const getBalanceSheet = (asOfDate: string) => {
    return useQuery({
      queryKey: ["balance-sheet", selectedCompany?.id, asOfDate],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("get_balance_sheet", {
          p_company_id: selectedCompany?.id,
          p_as_of_date: asOfDate,
        });

        if (error) throw error;
        return data as BalanceSheetRow[];
      },
      enabled: !!selectedCompany?.id && !!asOfDate,
    });
  };

  const getCashFlowStatement = (startDate: string, endDate: string) => {
    return useQuery({
      queryKey: ["cash-flow-statement", selectedCompany?.id, startDate, endDate],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("get_cash_flow_statement", {
          p_company_id: selectedCompany?.id,
          p_start_date: startDate,
          p_end_date: endDate,
        });

        if (error) throw error;
        return data as CashFlowRow[];
      },
      enabled: !!selectedCompany?.id && !!startDate && !!endDate,
    });
  };

  const getAgingReport = (asOfDate: string, invoiceType: "customer" | "supplier") => {
    return useQuery({
      queryKey: ["aging-report", selectedCompany?.id, asOfDate, invoiceType],
      queryFn: async () => {
        const { data, error } = await supabase.rpc("calculate_aging_buckets", {
          p_company_id: selectedCompany?.id,
          p_as_of_date: asOfDate,
          p_invoice_type: invoiceType,
        });

        if (error) throw error;
        return data as AgingBucketRow[];
      },
      enabled: !!selectedCompany?.id && !!asOfDate,
    });
  };

  // Legacy getProfitLoss function for backward compatibility
  const getProfitLoss = (startDate: string, endDate: string) => {
    return useQuery({
      queryKey: ["profit-loss", selectedCompany?.id, startDate, endDate],
      queryFn: async () => {
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
    getProfitLossReport,
    getBalanceSheet,
    getCashFlowStatement,
    getAgingReport,
  };
};
