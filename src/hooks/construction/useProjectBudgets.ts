import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import type { ProjectBudgetItem, CreateProjectBudgetItemData, UpdateProjectBudgetItemData, BudgetTransaction } from "@/types/construction";

type ProjectBudgetItemWithProject = Omit<ProjectBudgetItem, 'project'> & {
  project?: { id: string; project_name: string; project_code: string } | null;
  transactions?: BudgetTransaction[];
};

export function useProjectBudgetItems(projectId?: string) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ["project-budget-items", selectedCompany?.id, projectId],
    queryFn: async () => {
      let query = supabase
        .from("project_budget_items")
        .select(`
          *,
          project:construction_projects(id, project_name, project_code),
          transactions:budget_transactions(*)
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
      return data as ProjectBudgetItemWithProject[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateProjectBudgetItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (data: CreateProjectBudgetItemData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from("project_budget_items")
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
      queryClient.invalidateQueries({ queryKey: ["project-budget-items"] });
      toast({ title: "Budget item created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error creating budget item", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateProjectBudgetItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateProjectBudgetItemData & { id: string }) => {
      const { data: result, error } = await supabase
        .from("project_budget_items")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-budget-items"] });
      toast({ title: "Budget item updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating budget item", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteProjectBudgetItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_budget_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-budget-items"] });
      toast({ title: "Budget item deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting budget item", description: error.message, variant: "destructive" });
    },
  });
}

// Budget Transactions
export function useCreateBudgetTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<BudgetTransaction, "id" | "created_at">) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from("budget_transactions")
        .insert({
          ...data,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-budget-items"] });
      toast({ title: "Transaction recorded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error recording transaction", description: error.message, variant: "destructive" });
    },
  });
}
