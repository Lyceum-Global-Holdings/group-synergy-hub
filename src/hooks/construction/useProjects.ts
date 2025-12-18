import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ConstructionProject } from "@/types/construction";
import { useCompany } from "@/contexts/CompanyContext";

export function useProjects() {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["construction-projects", selectedCompany?.id],
    queryFn: async (): Promise<ConstructionProject[]> => {
      let query = supabase
        .from("construction_projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ConstructionProject[];
    },
    enabled: true,
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
      return data as ConstructionProject;
    },
    enabled: !!projectId,
  });
}
