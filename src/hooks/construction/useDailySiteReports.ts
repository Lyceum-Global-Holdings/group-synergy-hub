import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import type { DailySiteReport, CreateDailySiteReportData, UpdateDailySiteReportData, SiteReportActivity } from "@/types/construction";

type DailySiteReportWithProject = Omit<DailySiteReport, 'project'> & {
  project?: { id: string; project_name: string; project_code: string } | null;
  activities?: SiteReportActivity[];
};

export function useDailySiteReports(projectId?: string) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["daily-site-reports", selectedCompany?.id, projectId],
    queryFn: async () => {
      let query = supabase
        .from("daily_site_reports")
        .select(`
          *,
          project:construction_projects(id, project_name, project_code),
          activities:site_report_activities(*)
        `)
        .order("report_date", { ascending: false });

      if (selectedCompany?.id) {
        query = query.eq("company_id", selectedCompany.id);
      }

      if (projectId) {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as DailySiteReportWithProject[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateDailySiteReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: CreateDailySiteReportData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const insertData = {
        ...data,
        company_id: selectedCompany?.id,
        submitted_by: user.user?.id,
      };
      
      const { data: result, error } = await supabase
        .from("daily_site_reports")
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-site-reports"] });
      toast({ title: "Daily site report created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating report", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateDailySiteReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateDailySiteReportData & { id: string }) => {
      const { data: result, error } = await supabase
        .from("daily_site_reports")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-site-reports"] });
      toast({ title: "Report updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating report", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteDailySiteReport() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("daily_site_reports")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-site-reports"] });
      toast({ title: "Report deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting report", description: error.message, variant: "destructive" });
    },
  });
}

// Site Report Activities
export function useCreateReportActivity() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<SiteReportActivity, "id" | "created_at">) => {
      const { data: result, error } = await supabase
        .from("site_report_activities")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-site-reports"] });
      toast({ title: "Activity added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error adding activity", description: error.message, variant: "destructive" });
    },
  });
}
