import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

// ─── Credit Notes ───
export function useCreditNotes() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["credit-notes", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("credit_notes")
        .select("*, customer:customers(customer_name)")
        .eq("company_id", selectedCompany!.id)
        .order("credit_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreditNoteStats() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["credit-note-stats", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("credit_notes")
        .select("status, amount, amount_applied")
        .eq("company_id", selectedCompany!.id);
      if (error) throw error;
      const items = (data || []) as any[];
      const total = items.length;
      const draft = items.filter((d) => d.status === "draft").length;
      const applied = items.filter((d) => d.status === "applied").length;
      const totalAmount = items.reduce((s, d) => s + Number(d.amount || 0), 0);
      const unapplied = items.reduce((s, d) => s + (Number(d.amount || 0) - Number(d.amount_applied || 0)), 0);
      return { total, draft, applied, totalAmount, unapplied };
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateCreditNote() {
  const qc = useQueryClient();
  const { selectedCompany } = useCompany();
  return useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const { error } = await (supabase as any).from("credit_notes").insert({
        ...values,
        company_id: selectedCompany!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit-notes"] });
      qc.invalidateQueries({ queryKey: ["credit-note-stats"] });
      toast.success("Credit note created");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ─── Customer Advances ───
export function useCustomerAdvances() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["customer-advances", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_advances")
        .select("*, customer:customers(customer_name)")
        .eq("company_id", selectedCompany!.id)
        .order("advance_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCustomerAdvanceStats() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["customer-advance-stats", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_advances")
        .select("status, original_amount, remaining_amount")
        .eq("company_id", selectedCompany!.id);
      if (error) throw error;
      const items = (data || []) as any[];
      const total = items.length;
      const totalReceived = items.reduce((s, d) => s + Number(d.original_amount || 0), 0);
      const outstanding = items.reduce((s, d) => s + Number(d.remaining_amount || 0), 0);
      const fullyApplied = items.filter((d) => Number(d.remaining_amount || 0) === 0).length;
      return { total, totalReceived, outstanding, fullyApplied };
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateCustomerAdvance() {
  const qc = useQueryClient();
  const { selectedCompany } = useCompany();
  return useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const { error } = await (supabase as any).from("customer_advances").insert({
        ...values,
        company_id: selectedCompany!.id,
        remaining_amount: values.original_amount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-advances"] });
      qc.invalidateQueries({ queryKey: ["customer-advance-stats"] });
      toast.success("Customer advance recorded");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ─── Bad Debt Provisions ───
export function useBadDebtProvisions() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["bad-debt-provisions", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bad_debt_provisions")
        .select("*, customer:customers(customer_name)")
        .eq("company_id", selectedCompany!.id)
        .order("provision_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useBadDebtStats() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["bad-debt-stats", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bad_debt_provisions")
        .select("status, amount, recovery_amount")
        .eq("company_id", selectedCompany!.id);
      if (error) throw error;
      const items = (data || []) as any[];
      const total = items.length;
      const totalProvisioned = items.reduce((s, d) => s + Number(d.amount || 0), 0);
      const totalRecovered = items.reduce((s, d) => s + Number(d.recovery_amount || 0), 0);
      const writtenOff = items.filter((d) => d.status === "written_off").length;
      return { total, totalProvisioned, totalRecovered, writtenOff };
    },
    enabled: !!selectedCompany?.id,
  });
}

// ─── AR Stats ───
export function useARStats() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["ar-stats", selectedCompany?.id],
    queryFn: async () => {
      const [invoices, receipts, customers] = await Promise.all([
        supabase
          .from("customer_invoices")
          .select("status, gross_amount, amount_received")
          .eq("company_id", selectedCompany!.id),
        supabase
          .from("customer_receipts")
          .select("status, total_amount")
          .eq("company_id", selectedCompany!.id),
        supabase
          .from("customers")
          .select("id, status")
          .eq("company_id", selectedCompany!.id),
      ]);
      if (invoices.error) throw invoices.error;

      const totalInvoices = invoices.data.length;
      const unpaid = invoices.data.filter((i) => i.status !== "paid" && i.status !== "cancelled");
      const outstandingAmount = unpaid.reduce(
        (s, i) => s + (Number(i.gross_amount || 0) - Number(i.amount_received || 0)), 0
      );
      const totalReceipts = receipts.data?.length || 0;
      const totalReceived = receipts.data?.reduce((s, r) => s + Number(r.total_amount || 0), 0) || 0;
      const totalCustomers = customers.data?.length || 0;
      const activeCustomers = customers.data?.filter((c: any) => c.status === "active").length || 0;

      return { totalInvoices, outstandingAmount, totalReceipts, totalReceived, totalCustomers, activeCustomers };
    },
    enabled: !!selectedCompany?.id,
  });
}
