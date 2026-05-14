import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_SUPPLIER_FORM_SCHEMA,
  SupplierFormSchema,
  mergeWithBaseline,
} from "@/lib/supplierFormSchema";

export interface PortalSettings {
  company_id: string;
  public_base_url: string | null;
  is_active: boolean;
}

export function useSupplierPortalSettings(companyId: string | undefined) {
  return useQuery<PortalSettings | null>({
    queryKey: ["supplier_portal_settings", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_portal_settings")
        .select("company_id, public_base_url, is_active")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return (data as PortalSettings | null) ?? null;
    },
  });
}

export function useSaveSupplierPortalSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { company_id: string; public_base_url: string | null }) => {
      const { error } = await supabase
        .from("supplier_portal_settings")
        .upsert(
          {
            company_id: input.company_id,
            public_base_url: input.public_base_url || null,
            is_active: true,
            updated_by: (await supabase.auth.getUser()).data.user?.id,
          },
          { onConflict: "company_id" },
        );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["supplier_portal_settings", vars.company_id] });
    },
  });
}

export interface FormConfigRow {
  id: string;
  company_id: string;
  version: number;
  is_published: boolean;
  schema: SupplierFormSchema;
}

export function useSupplierFormConfig(companyId: string | undefined) {
  return useQuery<FormConfigRow | null>({
    queryKey: ["supplier_form_config", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_registration_form_config")
        .select("id, company_id, version, is_published, schema")
        .eq("company_id", companyId!)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...(data as any),
        schema: mergeWithBaseline(data.schema as SupplierFormSchema),
      };
    },
  });
}

export function useSaveSupplierFormConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { company_id: string; schema: SupplierFormSchema; publish: boolean }) => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      // Find current max version
      const { data: existing } = await supabase
        .from("supplier_registration_form_config")
        .select("version")
        .eq("company_id", input.company_id)
        .order("version", { ascending: false })
        .limit(1);
      const nextVersion = (existing?.[0]?.version ?? 0) + 1;

      if (input.publish) {
        // Unpublish existing
        await supabase
          .from("supplier_registration_form_config")
          .update({ is_published: false })
          .eq("company_id", input.company_id)
          .eq("is_published", true);
      }
      const { error } = await supabase
        .from("supplier_registration_form_config")
        .insert({
          company_id: input.company_id,
          version: nextVersion,
          is_published: input.publish,
          schema: { ...input.schema, version: nextVersion } as any,
          updated_by: userId,
        });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["supplier_form_config", vars.company_id] });
    },
  });
}

/** Public (anon) fetch by company slug — used by /n */
export async function fetchPublicSupplierForm(slug: string) {
  const { data, error } = await supabase.rpc("get_published_supplier_form", { _slug: slug });
  if (error) throw error;
  const row = (data as any[])?.[0];
  if (!row) return null;
  return {
    company_id: row.company_id as string,
    company_name: row.company_name as string,
    schema: mergeWithBaseline(row.schema as SupplierFormSchema | null),
    version: row.version as number | null,
  };
}

export { DEFAULT_SUPPLIER_FORM_SCHEMA };
