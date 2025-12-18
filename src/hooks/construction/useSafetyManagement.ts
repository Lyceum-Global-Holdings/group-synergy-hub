import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import type { SafetyIncident, SafetyInspection, CreateSafetyIncidentData, UpdateSafetyIncidentData, CreateSafetyInspectionData, UpdateSafetyInspectionData } from "@/types/construction";

type SafetyIncidentWithProject = Omit<SafetyIncident, 'project'> & {
  project?: { id: string; project_name: string; project_code: string } | null;
};

type SafetyInspectionWithProject = Omit<SafetyInspection, 'project'> & {
  project?: { id: string; project_name: string; project_code: string } | null;
};

// Safety Incidents
export function useSafetyIncidents(projectId?: string) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["safety-incidents", selectedCompany?.id, projectId],
    queryFn: async () => {
      let query = supabase
        .from("safety_incidents")
        .select(`
          *,
          project:construction_projects(id, project_name, project_code)
        `)
        .order("incident_date", { ascending: false });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as SafetyIncidentWithProject[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateSafetyIncident() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: CreateSafetyIncidentData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const insertData = {
        ...data,
        company_id: selectedCompany?.id,
        reported_by: user.user?.id,
      };
      
      const { data: result, error } = await supabase
        .from("safety_incidents")
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety-incidents"] });
      toast({ title: "Safety incident reported successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error reporting incident", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateSafetyIncident() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateSafetyIncidentData & { id: string }) => {
      const { data: result, error } = await supabase
        .from("safety_incidents")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety-incidents"] });
      toast({ title: "Incident updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating incident", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteSafetyIncident() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("safety_incidents")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety-incidents"] });
      toast({ title: "Incident deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting incident", description: error.message, variant: "destructive" });
    },
  });
}

// Safety Inspections
export function useSafetyInspections(projectId?: string) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["safety-inspections", selectedCompany?.id, projectId],
    queryFn: async () => {
      let query = supabase
        .from("safety_inspections")
        .select(`
          *,
          project:construction_projects(id, project_name, project_code)
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
      return data as SafetyInspectionWithProject[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateSafetyInspection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: CreateSafetyInspectionData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const insertData = {
        ...data,
        company_id: selectedCompany?.id,
        inspector_id: user.user?.id,
        created_by: user.user?.id,
      };
      
      const { data: result, error } = await supabase
        .from("safety_inspections")
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety-inspections"] });
      toast({ title: "Safety inspection created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating inspection", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateSafetyInspection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateSafetyInspectionData & { id: string }) => {
      const { data: result, error } = await supabase
        .from("safety_inspections")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety-inspections"] });
      toast({ title: "Inspection updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating inspection", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteSafetyInspection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("safety_inspections")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety-inspections"] });
      toast({ title: "Inspection deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting inspection", description: error.message, variant: "destructive" });
    },
  });
}
