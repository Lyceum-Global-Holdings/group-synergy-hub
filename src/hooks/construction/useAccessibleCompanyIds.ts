import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

/**
 * Returns all company IDs the user can access for construction inventory reads.
 *
 * Sources (merged + deduplicated):
 * - active company selector options
 * - actively selected company
 * - user_company_access memberships (authoritative backend mapping)
 */
export function useAccessibleCompanyIds() {
  const { selectedCompany, companies } = useCompany();

  const {
    data: membershipCompanyIds = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["construction-accessible-company-memberships"],
    queryFn: async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) return [];

      const { data, error: accessError } = await supabase
        .from("user_company_access")
        .select("company_id")
        .eq("user_id", authData.user.id);

      if (accessError) {
        console.warn("[useAccessibleCompanyIds] Failed to load memberships:", accessError.message);
        return [];
      }

      return (data ?? []).map((row) => row.company_id).filter(Boolean);
    },
    staleTime: 5 * 60 * 1000,
  });

  const accessibleCompanyIds = useMemo(() => {
    const ids = new Set<string>();

    if (selectedCompany?.id) {
      ids.add(selectedCompany.id);
    }

    (companies ?? []).forEach((company) => {
      if (company?.id) {
        ids.add(company.id);
      }
    });

    membershipCompanyIds.forEach((companyId) => {
      if (companyId) {
        ids.add(companyId);
      }
    });

    return Array.from(ids);
  }, [selectedCompany?.id, companies, membershipCompanyIds]);

  return {
    data: accessibleCompanyIds,
    isLoading,
    error,
  };
}

