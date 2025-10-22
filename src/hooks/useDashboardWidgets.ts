import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardWidget } from "@/types/dashboard";
import { toast } from "sonner";

export function useDashboardWidgets(dashboardId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard-widgets", dashboardId],
    queryFn: async () => {
      if (!dashboardId) return [];

      const { data, error } = await supabase
        .from("dashboard_widgets")
        .select("*")
        .eq("dashboard_id", dashboardId)
        .order("position_y", { ascending: true })
        .order("position_x", { ascending: true });

      if (error) throw error;
      return data as DashboardWidget[];
    },
    enabled: !!dashboardId,
  });
}

export function useDashboardWidgetMutations() {
  const queryClient = useQueryClient();

  const createWidget = useMutation({
    mutationFn: async (widget: Partial<DashboardWidget>) => {
      const { data, error } = await supabase
        .from("dashboard_widgets")
        .insert({
          dashboard_id: widget.dashboard_id!,
          kpi_id: widget.kpi_id,
          widget_type: widget.widget_type!,
          title: widget.title!,
          position_x: widget.position_x,
          position_y: widget.position_y,
          width: widget.width,
          height: widget.height,
          config: widget.config || {},
          filter_config: widget.filter_config,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-widgets", variables.dashboard_id] });
      toast.success("Widget added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add widget: ${error.message}`);
    },
  });

  const updateWidget = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DashboardWidget> & { id: string }) => {
      const updateData: any = {};
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.widget_type !== undefined) updateData.widget_type = updates.widget_type;
      if (updates.kpi_id !== undefined) updateData.kpi_id = updates.kpi_id;
      if (updates.position_x !== undefined) updateData.position_x = updates.position_x;
      if (updates.position_y !== undefined) updateData.position_y = updates.position_y;
      if (updates.width !== undefined) updateData.width = updates.width;
      if (updates.height !== undefined) updateData.height = updates.height;
      if (updates.config !== undefined) updateData.config = updates.config;
      if (updates.filter_config !== undefined) updateData.filter_config = updates.filter_config;
      
      const { data, error } = await supabase
        .from("dashboard_widgets")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-widgets"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update widget: ${error.message}`);
    },
  });

  const deleteWidget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dashboard_widgets")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-widgets"] });
      toast.success("Widget removed successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove widget: ${error.message}`);
    },
  });

  return {
    createWidget,
    updateWidget,
    deleteWidget,
  };
}
