import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import type { QualityInspection, CreateQualityInspectionData, UpdateQualityInspectionData, QualityInspectionItem } from "@/types/construction";

type QualityInspectionWithProject = Omit<QualityInspection, 'project'> & {
  project?: { id: string; project_name: string; project_code: string } | null;
  items?: QualityInspectionItem[];
};

export function useQualityInspections(projectId?: string) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["quality-inspections", selectedCompany?.id, projectId],
    queryFn: async () => {
      let query = supabase
        .from("quality_inspections")
        .select(`
          *,
          project:construction_projects(id, project_name, project_code),
          items:quality_inspection_items(*)
        `)
        .order("inspection_date", { ascending: false });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as QualityInspectionWithProject[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateQualityInspection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: CreateQualityInspectionData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const insertData = {
        ...data,
        company_id: selectedCompany?.id,
        created_by: user.user?.id,
      };
      
      const { data: result, error } = await supabase
        .from("quality_inspections")
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-inspections"] });
      toast({ title: "Quality inspection created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating inspection", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateQualityInspection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateQualityInspectionData & { id: string }) => {
      const { data: result, error } = await supabase
        .from("quality_inspections")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-inspections"] });
      toast({ title: "Inspection updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating inspection", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteQualityInspection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("quality_inspections")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-inspections"] });
      toast({ title: "Inspection deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting inspection", description: error.message, variant: "destructive" });
    },
  });
}

// Inspection Items
export function useCreateInspectionItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<QualityInspectionItem, "id" | "created_at">) => {
      const { data: result, error } = await supabase
        .from("quality_inspection_items")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quality-inspections"] });
      toast({ title: "Inspection item added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error adding inspection item", description: error.message, variant: "destructive" });
    },
  });
}
