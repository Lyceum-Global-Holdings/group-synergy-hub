import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import type { WorkOrder, CreateWorkOrderData, UpdateWorkOrderData } from "@/types/construction";

type WorkOrderWithProject = Omit<WorkOrder, 'project'> & {
  project?: { id: string; project_name: string; project_code: string } | null;
};

export function useWorkOrders(projectId?: string) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["construction-work-orders", selectedCompany?.id, projectId],
    queryFn: async () => {
      let query = supabase
        .from("construction_work_orders")
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

      const { data, error } = await query;

      if (error) throw error;
      return data as WorkOrderWithProject[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateWorkOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: CreateWorkOrderData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const insertData = {
        ...data,
        company_id: selectedCompany?.id,
        created_by: user.user?.id,
      };
      
      const { data: result, error } = await supabase
        .from("construction_work_orders")
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-work-orders"] });
      toast({ title: "Work order created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating work order", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateWorkOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateWorkOrderData & { id: string }) => {
      const { data: result, error } = await supabase
        .from("construction_work_orders")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-work-orders"] });
      toast({ title: "Work order updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating work order", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteWorkOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("construction_work_orders")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["construction-work-orders"] });
      toast({ title: "Work order deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting work order", description: error.message, variant: "destructive" });
    },
  });
}
