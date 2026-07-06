import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import type { ConstructionResource, CreateConstructionResourceData, UpdateConstructionResourceData } from "@/types/construction";

type ConstructionResourceWithProject = Omit<ConstructionResource, 'project'> & {
  project?: { id: string; project_name: string; project_code: string } | null;
};

interface UseConstructionResourcesOptions {
  /** ISO YYYY-MM-DD as-of date. When set, only rows active on that date are returned. */
  asOfDate?: string;
}

export function useConstructionResources(
  projectId?: string,
  options: UseConstructionResourcesOptions = {}
) {
  const { selectedCompany } = useCompany();
  const { asOfDate } = options;

  return useQuery({
    queryKey: ["construction-resources", selectedCompany?.id, projectId, asOfDate ?? null],
    queryFn: async () => {
      let query = supabase
        .from("construction_resources")
        .select(`
          *,
          project:construction_projects(id, project_name, project_code)
        `)
        .order("created_at", { ascending: false });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      if (asOfDate) {
        // Active on date when: (start_date IS NULL OR start_date <= asOf)
        //                AND  (end_date   IS NULL OR end_date   >= asOf)
        query = query
          .or(`start_date.is.null,start_date.lte.${asOfDate}`)
          .or(`end_date.is.null,end_date.gte.${asOfDate}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ConstructionResourceWithProject[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateConstructionResource() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: CreateConstructionResourceData) => {
      const user = { user: getCachedUser() };
      
      const { data: result, error } = await supabase
        .from("construction_resources")
        .insert({
          ...data,
          company_id: selectedCompany?.id,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-resources"] });
      toast({ title: "Resource created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating resource", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateConstructionResource() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateConstructionResourceData & { id: string }) => {
      const { data: result, error } = await supabase
        .from("construction_resources")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-resources"] });
      toast({ title: "Resource updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating resource", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteConstructionResource() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("construction_resources")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-resources"] });
      toast({ title: "Resource deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting resource", description: error.message, variant: "destructive" });
    },
  });
}
