import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { RiskAlertRule, CreateAlertRuleData } from "@/types/supplierRisk";

export const useRiskAlertRules = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all alert rules
  const { data: alertRules, isLoading, error } = useQuery({
    queryKey: ['risk-alert-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('risk_alert_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RiskAlertRule[];
    },
  });

  // Create alert rule
  const createAlertRule = useMutation({
    mutationFn: async (ruleData: CreateAlertRuleData) => {
      const { data, error } = await supabase
        .from('risk_alert_rules')
        .insert(ruleData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-alert-rules'] });
      toast({
        title: "Alert rule created",
        description: "The alert rule has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating alert rule",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update alert rule
  const updateAlertRule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CreateAlertRuleData> & { id: string }) => {
      const { data, error } = await supabase
        .from('risk_alert_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-alert-rules'] });
      toast({
        title: "Alert rule updated",
        description: "The alert rule has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating alert rule",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle alert rule active status
  const toggleAlertRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('risk_alert_rules')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['risk-alert-rules'] });
      toast({
        title: variables.is_active ? "Alert rule enabled" : "Alert rule disabled",
        description: `The alert rule has been ${variables.is_active ? 'enabled' : 'disabled'}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error toggling alert rule",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete alert rule
  const deleteAlertRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('risk_alert_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-alert-rules'] });
      toast({
        title: "Alert rule deleted",
        description: "The alert rule has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting alert rule",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    alertRules,
    isLoading,
    error,
    createAlertRule,
    updateAlertRule,
    toggleAlertRule,
    deleteAlertRule,
  };
};
