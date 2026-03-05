import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ConstructionProject } from "@/types/construction";
import { useAccessibleCompanyIds } from "./useAccessibleCompanyIds";

export function useProjects() {
  const { data: accessibleIds = [] } = useAccessibleCompanyIds();

  return useQuery({
    queryKey: ["construction-projects", accessibleIds],
    queryFn: async (): Promise<ConstructionProject[]> => {
      // Fetch projects via junction table for accessible companies
      let projectIds = new Set<string>();

      if (accessibleIds.length > 0) {
        const { data: mappings } = await supabase
          .from("construction_project_companies")
          .select("project_id")
          .in("company_id", accessibleIds);

        (mappings || []).forEach((m) => projectIds.add(m.project_id));

        // Also include projects with legacy company_id match
        const { data: legacyProjects } = await supabase
          .from("construction_projects")
          .select("id")
          .in("company_id", accessibleIds);

        (legacyProjects || []).forEach((p) => projectIds.add(p.id));
      }

      const ids = Array.from(projectIds);
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from("construction_projects")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch company mappings for all projects
      const { data: allMappings } = await supabase
        .from("construction_project_companies")
        .select("project_id, company_id")
        .in("project_id", ids);

      const companyMap = new Map<string, string[]>();
      (allMappings || []).forEach((m) => {
        const list = companyMap.get(m.project_id) || [];
        list.push(m.company_id);
        companyMap.set(m.project_id, list);
      });

      return (data || []).map((p) => ({
        ...p,
        company_ids: companyMap.get(p.id) || (p.company_id ? [p.company_id] : []),
      })) as ConstructionProject[];
    },
    enabled: accessibleIds.length > 0,
  });
}

export function useProject(projectId: string | null) {
  return useQuery({
    queryKey: ["construction-project", projectId],
    queryFn: async (): Promise<ConstructionProject | null> => {
      if (!projectId) return null;

      const { data, error } = await supabase
        .from("construction_projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) throw error;

      // Fetch company mappings
      const { data: mappings } = await supabase
        .from("construction_project_companies")
        .select("company_id")
        .eq("project_id", projectId);

      return {
        ...data,
        company_ids: (mappings || []).map((m) => m.company_id),
      } as ConstructionProject;
    },
    enabled: !!projectId,
  });
}
