import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

// ─── Cheques ───
export function useCheques() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["cheques", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cheques")
        .select("*, bank_account:bank_accounts(account_name)")
        .eq("company_id", selectedCompany!.id)
        .order("cheque_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useChequeStats() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["cheque-stats", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cheques")
        .select("status, cheque_type, amount, is_post_dated")
        .eq("company_id", selectedCompany!.id);
      if (error) throw error;
      const items = (data || []) as any[];
      const total = items.length;
      const issued = items.filter((c) => c.cheque_type === "issued").length;
      const received = items.filter((c) => c.cheque_type === "received").length;
      const postDated = items.filter((c) => c.is_post_dated).length;
      const totalAmount = items.reduce((s, c) => s + Number(c.amount || 0), 0);
      const pending = items.filter((c) => c.status === "issued" || c.status === "received").length;
      return { total, issued, received, postDated, totalAmount, pending };
    },
    enabled: !!selectedCompany?.id,
  });
}

// ─── Fund Transfers ───
export function useFundTransfers() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["fund-transfers", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("fund_transfers")
        .select("*, from_account:bank_accounts!fund_transfers_from_account_id_fkey(account_name), to_account:bank_accounts!fund_transfers_to_account_id_fkey(account_name)")
        .eq("company_id", selectedCompany!.id)
        .order("transfer_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useFundTransferStats() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["fund-transfer-stats", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("fund_transfers")
        .select("status, amount")
        .eq("company_id", selectedCompany!.id);
      if (error) throw error;
      const items = (data || []) as any[];
      const total = items.length;
      const totalAmount = items.reduce((s, t) => s + Number(t.amount || 0), 0);
      const pending = items.filter((t) => t.status === "pending").length;
      const completed = items.filter((t) => t.status === "completed").length;
      return { total, totalAmount, pending, completed };
    },
    enabled: !!selectedCompany?.id,
  });
}

// ─── Payment Batches ───
export function usePaymentBatches() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["payment-batches", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payment_batches")
        .select("*, bank_account:bank_accounts(account_name)")
        .eq("company_id", selectedCompany!.id)
        .order("batch_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function usePaymentBatchStats() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["payment-batch-stats", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payment_batches")
        .select("status, total_amount, payment_count")
        .eq("company_id", selectedCompany!.id);
      if (error) throw error;
      const items = (data || []) as any[];
      const total = items.length;
      const totalAmount = items.reduce((s, b) => s + Number(b.total_amount || 0), 0);
      const totalPayments = items.reduce((s, b) => s + Number(b.payment_count || 0), 0);
      const draft = items.filter((b) => b.status === "draft").length;
      return { total, totalAmount, totalPayments, draft };
    },
    enabled: !!selectedCompany?.id,
  });
}

// ─── Transaction Rules ───
export function useTransactionRules() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["transaction-rules", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transaction_rules")
        .select("*, gl_account:chart_of_accounts(account_name)")
        .eq("company_id", selectedCompany!.id)
        .order("priority", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedCompany?.id,
  });
}

// ─── Banking Stats ───
export function useBankingStats() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["banking-stats", selectedCompany?.id],
    queryFn: async () => {
      const [accounts, transactions] = await Promise.all([
        supabase
          .from("bank_accounts")
          .select("id, current_balance, is_active")
          .eq("company_id", selectedCompany!.id),
        supabase
          .from("bank_transactions")
          .select("id, debit_amount, credit_amount, is_reconciled")
          .eq("company_id", selectedCompany!.id),
      ]);
      if (accounts.error) throw accounts.error;

      const totalAccounts = accounts.data.length;
      const activeAccounts = accounts.data.filter((a) => a.is_active).length;
      const totalBalance = accounts.data.reduce((s, a) => s + Number(a.current_balance || 0), 0);
      const totalTransactions = transactions.data?.length || 0;
      const unreconciledCount = transactions.data?.filter((t) => !t.is_reconciled).length || 0;

      return { totalAccounts, activeAccounts, totalBalance, totalTransactions, unreconciledCount };
    },
    enabled: !!selectedCompany?.id,
  });
}
