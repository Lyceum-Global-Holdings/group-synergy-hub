import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

// ─── Petty Cash Funds ───
export function usePettyCashFunds() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["petty-cash-funds", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("petty_cash_funds")
        .select("*")
        .eq("company_id", selectedCompany!.id)
        .order("fund_name");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function usePettyCashFundStats() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["petty-cash-fund-stats", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("petty_cash_funds")
        .select("status, float_amount, current_balance")
        .eq("company_id", selectedCompany!.id);
      if (error) throw error;
      const items = (data || []) as any[];
      const totalFunds = items.length;
      const activeFunds = items.filter((f) => f.status === "active").length;
      const totalFloat = items.reduce((s, f) => s + Number(f.float_amount || 0), 0);
      const totalBalance = items.reduce((s, f) => s + Number(f.current_balance || 0), 0);
      return { totalFunds, activeFunds, totalFloat, totalBalance };
    },
    enabled: !!selectedCompany?.id,
  });
}

// ─── Petty Cash Vouchers ───
export function usePettyCashVouchers() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["petty-cash-vouchers", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("petty_cash_vouchers")
        .select("*, fund:petty_cash_funds(fund_name)")
        .eq("company_id", selectedCompany!.id)
        .order("voucher_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function usePettyCashVoucherStats() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["petty-cash-voucher-stats", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("petty_cash_vouchers")
        .select("status, amount")
        .eq("company_id", selectedCompany!.id);
      if (error) throw error;
      const items = (data || []) as any[];
      const total = items.length;
      const draft = items.filter((v) => v.status === "draft").length;
      const approved = items.filter((v) => v.status === "approved").length;
      const totalAmount = items.reduce((s, v) => s + Number(v.amount || 0), 0);
      return { total, draft, approved, totalAmount };
    },
    enabled: !!selectedCompany?.id,
  });
}

// ─── Staff Advances ───
export function useStaffAdvances() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["staff-advances", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("staff_advances")
        .select("*")
        .eq("company_id", selectedCompany!.id)
        .order("advance_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useStaffAdvanceStats() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["staff-advance-stats", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("staff_advances")
        .select("status, disbursed_amount, settled_amount, outstanding_amount")
        .eq("company_id", selectedCompany!.id);
      if (error) throw error;
      const items = (data || []) as any[];
      const total = items.length;
      const pending = items.filter((a) => a.status === "pending").length;
      const totalDisbursed = items.reduce((s, a) => s + Number(a.disbursed_amount || 0), 0);
      const totalOutstanding = items.reduce((s, a) => s + Number(a.outstanding_amount || 0), 0);
      const totalSettled = items.reduce((s, a) => s + Number(a.settled_amount || 0), 0);
      return { total, pending, totalDisbursed, totalOutstanding, totalSettled };
    },
    enabled: !!selectedCompany?.id,
  });
}

// ─── Expenses Dashboard Stats ───
export function useExpensesDashboard() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["expenses-dashboard", selectedCompany?.id],
    queryFn: async () => {
      const [invoices, funds, advances] = await Promise.all([
        (supabase as any)
          .from("supplier_invoices")
          .select("status, gross_amount")
          .eq("company_id", selectedCompany!.id),
        (supabase as any)
          .from("petty_cash_funds")
          .select("current_balance")
          .eq("company_id", selectedCompany!.id)
          .eq("status", "active"),
        (supabase as any)
          .from("staff_advances")
          .select("outstanding_amount")
          .eq("company_id", selectedCompany!.id)
          .neq("status", "settled"),
      ]);

      const totalExpenses = (invoices.data || []).reduce(
        (s: number, i: any) => s + Number(i.gross_amount || 0), 0
      );
      const pendingApprovals = (invoices.data || []).filter(
        (i: any) => i.status === "pending_approval"
      ).length;
      const pettyCashBalance = (funds.data || []).reduce(
        (s: number, f: any) => s + Number(f.current_balance || 0), 0
      );
      const outstandingAdvances = (advances.data || []).reduce(
        (s: number, a: any) => s + Number(a.outstanding_amount || 0), 0
      );

      return { totalExpenses, pendingApprovals, pettyCashBalance, outstandingAdvances };
    },
    enabled: !!selectedCompany?.id,
  });
}
