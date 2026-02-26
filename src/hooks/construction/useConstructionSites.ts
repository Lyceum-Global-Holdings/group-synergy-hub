import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAccessibleCompanyIds } from "./useAccessibleCompanyIds";

/**
 * Fetches project_sites for accessible companies via their construction_projects.
 */
export function useConstructionSites() {
  const { selectedCompany } = useCompany();
  const { data: accessibleIds } = useAccessibleCompanyIds();

  return useQuery({
    queryKey: ["construction-project-sites", selectedCompany?.id, accessibleIds],
    queryFn: async () => {
      const companyIds =
        accessibleIds && accessibleIds.length > 0
          ? accessibleIds
          : selectedCompany?.id
          ? [selectedCompany.id]
          : [];

      if (companyIds.length === 0) return [];

      // Get project IDs for accessible companies
      const { data: projects, error: projError } = await supabase
        .from("construction_projects")
        .select("id")
        .in("company_id", companyIds);

      if (projError) throw projError;
      if (!projects || projects.length === 0) return [];

      const projectIds = projects.map((p) => p.id);

      // Get sites for those projects
      const { data: sites, error: sitesError } = await supabase
        .from("project_sites")
        .select("id, site_name, site_code, status, project_id")
        .in("project_id", projectIds)
        .order("site_name", { ascending: true });

      if (sitesError) throw sitesError;
      return sites || [];
    },
    enabled: !!selectedCompany?.id,
  });
}
