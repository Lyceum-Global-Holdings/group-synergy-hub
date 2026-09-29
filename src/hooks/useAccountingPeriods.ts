import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { untypedRpc } from "@/lib/untypedRpc";
import type { AccountingPeriod, FiscalYear } from "@/types/generalLedger";

export interface StockLedgerStatus {
  configured: boolean;
  start_date: string | null;
  pending: number;
  pending_value: number;
  problems: { document: string; problem: string }[];
  posted_value_30d: number;
  no_cost_30d: number;
  last_posted_at: string | null;
}

/**
 * Fiscal years and their periods. Opening, closing and reopening go through
 * database functions that enforce the order and the checks (no draft journals,
 * stock posted) — the tables can't be edited directly.
 */
export const useAccountingPeriods = () => {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const queryClient = useQueryClient();

  const { data: periods, isLoading: periodsLoading } = useQuery({
    queryKey: ["accounting-periods", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_periods")
        .select("*")
        .eq("company_id", companyId)
        .order("start_date", { ascending: false });

      if (error) throw error;
      return data as AccountingPeriod[];
    },
    enabled: !!companyId,
  });

  const { data: fiscalYears, isLoading: fiscalYearsLoading } = useQuery({
    queryKey: ["fiscal-years", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_years")
        .select("*")
        .eq("company_id", companyId)
        .order("start_date", { ascending: false });

      if (error) throw error;
      return data as FiscalYear[];
    },
    enabled: !!companyId,
  });

  const refresh = () => {
    for (const key of ["accounting-periods", "fiscal-years", "stock-ledger-status", "journal-entries", "chart-of-accounts"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const step = useMutation({
    mutationFn: ({ fn, args }: { fn: string; args: Record<string, unknown>; done: string }) => untypedRpc<unknown>(fn, args),
    onSuccess: (_d, v) => { refresh(); toast.success(v.done); },
    onError: (e: Error) => toast.error(e.message),
  });

  const currentPeriod = periods?.find((p) => p.status === "open");

  return {
    periods,
    fiscalYears,
    currentPeriod,
    isLoading: periodsLoading || fiscalYearsLoading,
    isPending: step.isPending,
    openFiscalYear: (startDate: string, name?: string, opts?: { onSuccess?: () => void }) =>
      step.mutate({ fn: "open_fiscal_year", args: { p_company_id: companyId, p_start_date: startDate, p_name: name || null }, done: "Fiscal year opened with twelve periods" }, opts),
    closePeriod: (periodId: string, opts?: { onSuccess?: () => void }) =>
      step.mutate({ fn: "close_accounting_period", args: { p_period_id: periodId }, done: "Period closed" }, opts),
    reopenPeriod: (periodId: string, reason: string, opts?: { onSuccess?: () => void }) =>
      step.mutate({ fn: "reopen_accounting_period", args: { p_period_id: periodId, p_reason: reason }, done: "Period reopened" }, opts),
    closeFiscalYear: (fiscalYearId: string, opts?: { onSuccess?: () => void }) =>
      step.mutate({ fn: "close_fiscal_year", args: { p_fiscal_year_id: fiscalYearId }, done: "Year closed to retained earnings" }, opts),
  };
};

/** What is waiting to post from the warehouse to the ledger, and a way to post it now. */
export function useStockLedger() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["stock-ledger-status", companyId],
    queryFn: () => untypedRpc<StockLedgerStatus>("stock_ledger_status", { p_company_id: companyId }),
    enabled: !!companyId,
  });
  const post = useMutation({
    mutationFn: () => untypedRpc<{ journals: number; rows: number; problems: { document: string; problem: string }[] }>(
      "post_stock_to_ledger", { p_company_id: companyId }),
    onSuccess: (r) => {
      for (const key of ["stock-ledger-status", "journal-entries", "chart-of-accounts"]) qc.invalidateQueries({ queryKey: [key] });
      if (r.problems?.length) toast.warning(`${r.journals} journal(s) posted; ${r.problems.length} document(s) still waiting`);
      else toast.success(r.journals ? `${r.journals} stock journal(s) posted` : "Nothing new to post");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return { status, post };
}
