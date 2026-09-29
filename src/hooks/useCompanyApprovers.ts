import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { untypedRpc } from "@/lib/untypedRpc";

export type ApprovalLevel = "hod" | "manager" | "finance" | "procurement" | "custom";

/** What each company-approver level can approve (enforced in the database). */
export const APPROVAL_LEVELS: { value: ApprovalLevel; label: string; approves: string }[] = [
  { value: "hod", label: "Head of department", approves: "Requisitions (first approval) · PO final approval" },
  { value: "manager", label: "Manager", approves: "Requisitions (first or final approval) · PO first or final approval" },
  { value: "finance", label: "Finance", approves: "Requisitions (first or final approval) · PO final approval" },
  { value: "procurement", label: "Procurement", approves: "PO first approval" },
  { value: "custom", label: "Other", approves: "PO first approval" },
];

export interface CompanyApproverRow {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  approval_level: ApprovalLevel;
  department: string | null;
  is_primary: boolean;
  can_approve_up_to_amount: number | null;
  deactivated: boolean;
  in_company: boolean;
}

interface Person {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export interface CompanyApprovalSetup {
  company_id: string;
  company_name: string;
  /** Requisitions above this also need a final approval; null = one level. */
  pr_final_approval_above: number | null;
  hod: Person | null;
  manager: Person | null;
  approvers: CompanyApproverRow[];
  /** Active users of the company who can be made approvers. */
  candidates: Person[];
}

/** Approvers, limits and the requisition threshold for one company (admins only). */
export function useCompanyApprovalSetup(companyId?: string) {
  return useQuery({
    queryKey: ["company-approval-setup", companyId],
    queryFn: () => untypedRpc<CompanyApprovalSetup>("company_approval_setup", { p_company_id: companyId }),
    enabled: !!companyId,
  });
}

export interface SaveApproverInput {
  id?: string;
  companyId: string;
  userId: string;
  level: ApprovalLevel;
  limit: number | null;
  department?: string;
  isPrimary?: boolean;
}

export function useSaveCompanyApprover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (a: SaveApproverInput) =>
      untypedRpc<string>("save_company_approver", {
        p_id: a.id ?? null,
        p_company_id: a.companyId,
        p_user_id: a.userId,
        p_level: a.level,
        p_limit: a.limit,
        p_department: a.department?.trim() || null,
        p_is_primary: !!a.isPrimary,
      }),
    onSuccess: (_id, a) => {
      queryClient.invalidateQueries({ queryKey: ["company-approval-setup", a.companyId] });
      toast.success(a.id ? "Approver updated" : "Approver added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveCompanyApprover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; companyId: string }) => untypedRpc<null>("remove_company_approver", { p_id: id }),
    onSuccess: (_r, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: ["company-approval-setup", companyId] });
      toast.success("Approver removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSaveCompanyApprovalSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, prFinalApprovalAbove }: { companyId: string; prFinalApprovalAbove: number | null }) =>
      untypedRpc<null>("save_company_approval_settings", {
        p_company_id: companyId,
        p_pr_final_approval_above: prFinalApprovalAbove,
      }),
    onSuccess: (_r, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: ["company-approval-setup", companyId] });
      toast.success("Requisition approval rule saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
