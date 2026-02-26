import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

/**
 * Returns all company IDs the current user can access.
 * Used by construction inventory hooks to show cross-company data
 * when a user has access to multiple companies.
 */
export function useAccessibleCompanyIds() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["accessible-company-ids", selectedCompany?.id],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return selectedCompany?.id ? [selectedCompany.id] : [];

      const userId = userData.user.id;

      // Check if super admin
      const { data: isSuperAdmin } = await supabase.rpc("is_super_admin", {
        _user_id: userId,
      });

      if (isSuperAdmin) {
        // Super admin: fetch all company IDs
        const { data: allCompanies } = await supabase
          .from("companies")
          .select("id");
        return allCompanies?.map((c) => c.id) || [];
      }

      // Regular user: get primary company + user_company_access
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", userId)
        .maybeSingle();

      const { data: accessData } = await supabase
        .from("user_company_access")
        .select("company_id")
        .eq("user_id", userId);

      const ids = new Set<string>();
      if (profile?.company_id) ids.add(profile.company_id);
      accessData?.forEach((a) => ids.add(a.company_id));

      return Array.from(ids);
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
