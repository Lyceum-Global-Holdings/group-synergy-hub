import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { Dashboard } from "@/types/dashboard";
import { toast } from "sonner";

export function useDashboardMutations() {
  const queryClient = useQueryClient();

  const createDashboard = useMutation({
    mutationFn: async (dashboard: Partial<Dashboard> & { created_by?: string }) => {
      const user = getCachedUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("dashboards")
        .insert({
          name: dashboard.name!,
          description: dashboard.description,
          visibility: dashboard.visibility,
          is_default: dashboard.is_default,
          layout_config: dashboard.layout_config || [],
          company_id: dashboard.company_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      toast.success("Dashboard created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create dashboard: ${error.message}`);
    },
  });

  const updateDashboard = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Dashboard> & { id: string }) => {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.visibility !== undefined) updateData.visibility = updates.visibility;
      if (updates.is_default !== undefined) updateData.is_default = updates.is_default;
      if (updates.layout_config !== undefined) updateData.layout_config = updates.layout_config;
      
      const { data, error } = await supabase
        .from("dashboards")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      toast.success("Dashboard updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update dashboard: ${error.message}`);
    },
  });

  const deleteDashboard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dashboards")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      toast.success("Dashboard deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete dashboard: ${error.message}`);
    },
  });

  return {
    createDashboard,
    updateDashboard,
    deleteDashboard,
  };
}
