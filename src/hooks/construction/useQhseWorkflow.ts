import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { untypedRpc } from "@/lib/untypedRpc";
import { useCompany } from "@/contexts/CompanyContext";

export type QhseSourceType = "quality_inspection" | "safety_incident" | "safety_inspection";
export type ActionStatus = "open" | "done" | "verified" | "cancelled";

export interface CorrectiveAction {
  id: string;
  action_number: string | null;
  source_type: QhseSourceType;
  source_id: string;
  action_type: "corrective" | "preventive";
  description: string;
  assigned_to: string | null;
  due_date: string | null;
  status: ActionStatus;
  completion_note: string | null;
  completed_by: string | null;
  completed_at: string | null;
  verified_by: string | null;
  verification_note: string | null;
}

/** An action typed into a form before it is saved. */
export interface ActionDraft {
  description: string;
  action_type: "corrective" | "preventive";
  assigned_to: string;
  due_date: string;
}

export const emptyAction = (): ActionDraft => ({ description: "", action_type: "corrective", assigned_to: "", due_date: "" });

/** Drafts with a description, in the shape the database functions take. */
export const actionsPayload = (drafts: ActionDraft[]) =>
  drafts
    .filter((a) => a.description.trim())
    .map((a) => ({
      description: a.description.trim(),
      action_type: a.action_type,
      assigned_to: a.assigned_to || null,
      due_date: a.due_date || null,
    }));

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  open: "Open",
  done: "Done – to verify",
  verified: "Verified",
  cancelled: "Cancelled",
};

export interface CompanyUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export function useCompanyUsers() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["company-user-directory", selectedCompany?.id],
    queryFn: () => untypedRpc<CompanyUser[]>("company_user_directory", { p_company_id: selectedCompany?.id }),
    enabled: !!selectedCompany?.id,
  });
}

export function useCorrectiveActions(sourceType: QhseSourceType, sourceId?: string) {
  return useQuery({
    queryKey: ["corrective-actions", sourceType, sourceId],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from("construction_corrective_actions")
        .select("*")
        .eq("source_type", sourceType)
        .eq("source_id", sourceId)
        .order("action_number");
      if (error) throw error;
      return (data ?? []) as CorrectiveAction[];
    },
    enabled: !!sourceId,
  });
}

/** Open actions of the company, for the page summaries. */
export function useOpenActionCounts() {
  const { selectedCompany } = useCompany();
  return useQuery({
    queryKey: ["corrective-actions", "open-counts", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { from: (t: string) => any })
        .from("construction_corrective_actions")
        .select("source_type, status, due_date")
        .eq("company_id", selectedCompany?.id)
        .in("status", ["open", "done"]);
      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);
      const rows = (data ?? []) as { source_type: QhseSourceType; status: ActionStatus; due_date: string | null }[];
      return {
        open: rows.filter((r) => r.status === "open").length,
        toVerify: rows.filter((r) => r.status === "done").length,
        overdue: rows.filter((r) => r.status === "open" && r.due_date && r.due_date < today).length,
      };
    },
    enabled: !!selectedCompany?.id,
  });
}

const REFRESH = ["quality-inspections", "safety-incidents", "safety-inspections", "corrective-actions", "approval-queue", "daily-site-reports"];

/**
 * Runs one workflow step (a database function) and refreshes the lists.
 * Each step checks its own rules; its message is shown when it refuses.
 */
export function useQhseStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fn, args }: { fn: string; args: Record<string, unknown>; done?: string }) => untypedRpc<unknown>(fn, args),
    onSuccess: (_d, v) => {
      for (const key of REFRESH) qc.invalidateQueries({ queryKey: [key] });
      if (v.done) toast.success(v.done);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
