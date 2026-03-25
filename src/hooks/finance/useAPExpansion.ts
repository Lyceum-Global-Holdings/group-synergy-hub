import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

// ─── Debit Notes ───
export function useDebitNotes() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["debit-notes", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debit_notes")
        .select("*, supplier:suppliers(supplier_name)")
        .eq("company_id", selectedCompany!.id)
        .order("debit_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useDebitNoteStats() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["debit-note-stats", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debit_notes")
        .select("status, amount")
        .eq("company_id", selectedCompany!.id);
      if (error) throw error;
      const total = data.length;
      const draft = data.filter((d) => d.status === "draft").length;
      const applied = data.filter((d) => d.status === "applied").length;
      const totalAmount = data.reduce((s, d) => s + Number(d.amount || 0), 0);
      return { total, draft, applied, totalAmount };
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateDebitNote() {
  const qc = useQueryClient();
  const { selectedCompany } = useCompany();
  return useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const { error } = await supabase.from("debit_notes").insert({
        ...values,
        company_id: selectedCompany!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["debit-notes"] });
      qc.invalidateQueries({ queryKey: ["debit-note-stats"] });
      toast.success("Debit note created");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ─── Vendor Advances ───
export function useVendorAdvances() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["vendor-advances", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_advances")
        .select("*, supplier:suppliers(supplier_name)")
        .eq("company_id", selectedCompany!.id)
        .order("advance_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useVendorAdvanceStats() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["vendor-advance-stats", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_advances")
        .select("status, amount, remaining_amount")
        .eq("company_id", selectedCompany!.id);
      if (error) throw error;
      const total = data.length;
      const outstanding = data.reduce((s, d) => s + Number(d.remaining_amount || 0), 0);
      const totalAdvanced = data.reduce((s, d) => s + Number(d.amount || 0), 0);
      const pending = data.filter((d) => d.status === "pending").length;
      return { total, outstanding, totalAdvanced, pending };
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateVendorAdvance() {
  const qc = useQueryClient();
  const { selectedCompany } = useCompany();
  return useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const { error } = await supabase.from("vendor_advances").insert({
        ...values,
        company_id: selectedCompany!.id,
        remaining_amount: values.amount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-advances"] });
      qc.invalidateQueries({ queryKey: ["vendor-advance-stats"] });
      toast.success("Vendor advance created");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ─── WHT Certificates ───
export function useWHTCertificates() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["wht-certificates", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wht_certificates")
        .select("*, supplier:suppliers(supplier_name)")
        .eq("company_id", selectedCompany!.id)
        .order("certificate_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useWHTStats() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["wht-stats", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wht_certificates")
        .select("status, wht_amount")
        .eq("company_id", selectedCompany!.id);
      if (error) throw error;
      const total = data.length;
      const totalWHT = data.reduce((s, d) => s + Number(d.wht_amount || 0), 0);
      const draft = data.filter((d) => d.status === "draft").length;
      return { total, totalWHT, draft };
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateWHTCertificate() {
  const qc = useQueryClient();
  const { selectedCompany } = useCompany();
  return useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const { error } = await supabase.from("wht_certificates").insert({
        ...values,
        company_id: selectedCompany!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wht-certificates"] });
      qc.invalidateQueries({ queryKey: ["wht-stats"] });
      toast.success("WHT certificate created");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ─── AP Stats (for vendor/payment center tabs) ───
export function useAPStats() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["ap-stats", selectedCompany?.id],
    queryFn: async () => {
      const [invoices, payments, suppliers] = await Promise.all([
        supabase
          .from("supplier_invoices")
          .select("status, gross_amount, amount_paid")
          .eq("company_id", selectedCompany!.id),
        supabase
          .from("supplier_payments")
          .select("status, total_amount")
          .eq("company_id", selectedCompany!.id),
        supabase
          .from("suppliers")
          .select("id, status")
          .eq("company_id", selectedCompany!.id),
      ]);
      if (invoices.error) throw invoices.error;
      if (payments.error) throw payments.error;

      const totalInvoices = invoices.data.length;
      const unpaid = invoices.data.filter((i) => i.status !== "paid" && i.status !== "cancelled");
      const outstandingAmount = unpaid.reduce(
        (s, i) => s + (Number(i.gross_amount || 0) - Number(i.amount_paid || 0)),
        0
      );
      const totalPayments = payments.data.length;
      const totalPaid = payments.data.reduce((s, p) => s + Number(p.total_amount || 0), 0);
      const totalSuppliers = suppliers.data?.length || 0;
      const activeSuppliers = suppliers.data?.filter((s) => s.status === "active").length || 0;

      return { totalInvoices, outstandingAmount, totalPayments, totalPaid, totalSuppliers, activeSuppliers };
    },
    enabled: !!selectedCompany?.id,
  });
}
