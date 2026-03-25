import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

export function useGeneralLedger(accountId?: string, dateRange?: { start: string; end: string }) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["general-ledger", selectedCompany?.id, accountId, dateRange],
    queryFn: async () => {
      let query = supabase
        .from("journal_entry_lines")
        .select(`
          *,
          journal_entry:journal_entries!inner(
            entry_number, entry_date, description, status, source_type
          ),
          account:chart_of_accounts!inner(
            account_code, account_name, account_type
          )
        `)
        .eq("journal_entries.status", "posted");

      if (selectedCompany?.id) {
        query = query.eq("journal_entries.company_id", selectedCompany.id);
      }
      if (accountId) {
        query = query.eq("account_id", accountId);
      }
      if (dateRange?.start) {
        query = query.gte("journal_entries.entry_date", dateRange.start);
      }
      if (dateRange?.end) {
        query = query.lte("journal_entries.entry_date", dateRange.end);
      }

      const { data, error } = await query.order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useLedgerSummary() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["ledger-summary", selectedCompany?.id],
    queryFn: async () => {
      const { data: accounts, error: accErr } = await supabase
        .from("chart_of_accounts")
        .select("id, account_type, is_active")
        .eq("company_id", selectedCompany!.id);
      if (accErr) throw accErr;

      const { data: entries, error: jeErr } = await supabase
        .from("journal_entries")
        .select("id, status")
        .eq("company_id", selectedCompany!.id);
      if (jeErr) throw jeErr;

      const { data: periods, error: pErr } = await supabase
        .from("accounting_periods")
        .select("id, status")
        .eq("company_id", selectedCompany!.id);
      if (pErr) throw pErr;

      return {
        totalAccounts: accounts?.filter((a) => a.is_active).length || 0,
        totalEntries: entries?.length || 0,
        postedEntries: entries?.filter((e) => e.status === "posted").length || 0,
        draftEntries: entries?.filter((e) => e.status === "draft").length || 0,
        pendingApproval: entries?.filter((e) => e.status === "draft").length || 0,
        openPeriods: periods?.filter((p) => p.status === "open").length || 0,
      };
    },
    enabled: !!selectedCompany?.id,
  });
}
