import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { untypedRpc } from "@/lib/untypedRpc";

export const NDA_BUCKET = "social-media-nda-documents";
export const NDA_MAX_BYTES = 10 * 1024 * 1024;
export const NDA_ALLOWED = ["application/pdf", "image/jpeg", "image/png"];

export type AccessStatus = "pending" | "active" | "rejected" | "revoked" | "nda_expired";

export const ACCESS_STATUS_LABEL: Record<AccessStatus, string> = {
  pending: "Waiting for approval",
  active: "Active",
  rejected: "Rejected",
  revoked: "Revoked",
  nda_expired: "Suspended: NDA expired",
};

export interface CompanyUser {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

/** Active users of the company, by login id (what access rows store). */
export function useSocialMediaCompanyUsers(companyId?: string) {
  return useQuery({
    queryKey: ["social-media-company-users", companyId],
    queryFn: () => untypedRpc<CompanyUser[]>("social_media_company_users", { p_company_id: companyId }),
    enabled: !!companyId,
  });
}

/** Whether the signed-in user approves access for this company (managers and admins). */
export function useSocialMediaRights(companyId?: string) {
  return useQuery({
    queryKey: ["social-media-rights", companyId],
    queryFn: () => untypedRpc<{ can_approve: boolean }>("social_media_rights", { p_company_id: companyId }),
    enabled: !!companyId,
  });
}

/** Why the signed-in user can't approve this request (null = they can). */
export function useAccessBlockReason(accessId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["social-media-access-block", accessId],
    queryFn: () => untypedRpc<string | null>("social_media_access_block_reason", { p_access_id: accessId }),
    enabled,
  });
}

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    for (const key of ["social-media-access", "social-media-access-nda", "social-media-ndas-all", "social-media-ndas-lookup",
      "social-media-access-block", "social-media-activity-log"]) {
      qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useRequestSocialMediaAccess() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: { accountId: string; userId: string; level: string; notes?: string }) =>
      untypedRpc<string>("request_social_media_access", {
        p_account_id: v.accountId, p_user_id: v.userId, p_access_level: v.level, p_notes: v.notes || null,
      }),
    onSuccess: () => { refresh(); toast.success("Access requested. Record the NDA, then a manager approves it."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDecideSocialMediaAccess() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: { accessId: string; approve: boolean; note?: string }) =>
      untypedRpc<string>("decide_social_media_access", { p_access_id: v.accessId, p_approve: v.approve, p_note: v.note || null }),
    onSuccess: (s) => { refresh(); toast.success(s === "active" ? "Access approved" : "Request rejected"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useChangeSocialMediaAccessLevel() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: { accessId: string; level: string }) =>
      untypedRpc<null>("change_social_media_access_level", { p_access_id: v.accessId, p_access_level: v.level }),
    onSuccess: () => { refresh(); toast.success("Access level updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRevokeSocialMediaAccess() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (v: { accessId: string; note?: string }) =>
      untypedRpc<null>("revoke_social_media_access", { p_access_id: v.accessId, p_note: v.note || null }),
    onSuccess: () => { refresh(); toast.success("Access revoked"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function ndaFileProblem(file: File | null): string | null {
  if (!file) return "Attach the signed NDA";
  if (!NDA_ALLOWED.includes(file.type)) return "Use a PDF, JPG or PNG file";
  if (file.size > NDA_MAX_BYTES) return "The file must be 10 MB or smaller";
  return null;
}

export interface RecordNdaInput {
  companyId: string;
  accessId: string;
  file: File;
  signedOn: string;
  expiryDate?: string;
  version: string;
  witnessName?: string;
  notes?: string;
}

/** Uploads the signed NDA to the company's folder, then records it. */
export function useRecordSocialMediaNda() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (v: RecordNdaInput) => {
      const problem = ndaFileProblem(v.file);
      if (problem) throw new Error(problem);
      const safeName = v.file.name.replace(/[^\w.-]+/g, "_");
      const path = `${v.companyId}/${v.accessId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from(NDA_BUCKET).upload(path, v.file, { contentType: v.file.type, upsert: false });
      if (uploadError) throw uploadError;
      return untypedRpc<string>("record_social_media_nda", {
        p_access_id: v.accessId,
        p_signed_on: v.signedOn,
        p_expiry_date: v.expiryDate || null,
        p_version: v.version,
        p_witness_name: v.witnessName || null,
        p_document_path: path,
        p_notes: v.notes || null,
      });
    },
    onSuccess: () => { refresh(); toast.success("NDA recorded"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export async function openNdaDocument(path: string) {
  const { data, error } = await supabase.storage.from(NDA_BUCKET).createSignedUrl(path, 120);
  if (error || !data?.signedUrl) {
    toast.error("Couldn't open the document");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

/** The NDA that counts for an access row: its most recent signed one (as the database decides). */
export function currentNda<T extends { access_id: string; nda_signed: boolean | null; nda_signed_at: string | null; created_at: string }>(
  ndas: T[],
  accessId: string,
): T | undefined {
  return ndas
    .filter((n) => n.access_id === accessId)
    .sort((a, b) =>
      Number(!!b.nda_signed) - Number(!!a.nda_signed)
      || (b.nda_signed_at ?? "").localeCompare(a.nda_signed_at ?? "")
      || b.created_at.localeCompare(a.created_at))[0];
}
