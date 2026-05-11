import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MfaPolicy = "disabled" | "optional" | "required_admins" | "required_all";

export interface SecuritySettings {
  id: string;
  turnstile_enabled: boolean;
  turnstile_surfaces: {
    auth: boolean;
    portal_login: boolean;
    portal_invite: boolean;
    public_registration: boolean;
    public_qr?: boolean;
  };
  mfa_policy: MfaPolicy;
  mfa_grace_period_days: number;
  mfa_remember_device_hours: number;
  allowed_mfa_factors: string[];
  updated_by: string | null;
  updated_at: string;
}

export function useSecuritySettings() {
  return useQuery<SecuritySettings>({
    queryKey: ["security-settings"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("security_settings")
        .select("*")
        .eq("id", "global")
        .maybeSingle();
      if (error) throw error;
      return data as SecuritySettings;
    },
  });
}

export function useUpdateSecuritySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<SecuritySettings, "id" | "updated_at" | "updated_by">>) => {
      const { data, error } = await (supabase as any)
        .from("security_settings")
        .update(patch)
        .eq("id", "global")
        .select()
        .single();
      if (error) throw error;
      return data as SecuritySettings;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["security-settings"] });
      qc.invalidateQueries({ queryKey: ["security-settings-public"] });
      qc.invalidateQueries({ queryKey: ["security-audit-log"] });
    },
  });
}

export interface SecurityAuditEntry {
  id: string;
  changed_by: string | null;
  changed_at: string;
  action: string;
  before_value: any;
  after_value: any;
}

export function useSecurityAuditLog(limit = 50) {
  return useQuery<SecurityAuditEntry[]>({
    queryKey: ["security-audit-log", limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("security_audit_log")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as SecurityAuditEntry[];
    },
  });
}
