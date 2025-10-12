import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { SupplierRiskFlag, CreateRiskFlagData, UpdateRiskFlagData } from "@/types/supplierRisk";

export const useSupplierRiskFlags = (supplierId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all risk flags or filter by supplier
  const { data: riskFlags, isLoading, error } = useQuery({
    queryKey: ['supplier-risk-flags', supplierId],
    queryFn: async () => {
      let query = supabase
        .from('supplier_risk_flags')
        .select('*, suppliers(name)')
        .order('flagged_date', { ascending: false });

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as SupplierRiskFlag[];
    },
  });

  // Create risk flag
  const createRiskFlag = useMutation({
    mutationFn: async (flagData: CreateRiskFlagData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('supplier_risk_flags')
        .insert({
          ...flagData,
          flagged_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-risk-flags'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: "Risk flag created",
        description: "The risk flag has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating risk flag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update risk flag
  const updateRiskFlag = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateRiskFlagData & { id: string }) => {
      const { data, error } = await supabase
        .from('supplier_risk_flags')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-risk-flags'] });
      queryClient.invalidateQueries({ queryKey: ['risk-flag-history'] });
      toast({
        title: "Risk flag updated",
        description: "The risk flag has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating risk flag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resolve risk flag
  const resolveRiskFlag = useMutation({
    mutationFn: async ({ id, resolution_notes }: { id: string; resolution_notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('supplier_risk_flags')
        .update({
          status: 'resolved',
          resolved_date: new Date().toISOString().split('T')[0],
          resolved_by: user.id,
          resolution_notes,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-risk-flags'] });
      queryClient.invalidateQueries({ queryKey: ['risk-flag-history'] });
      toast({
        title: "Risk flag resolved",
        description: "The risk flag has been marked as resolved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error resolving risk flag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Escalate risk flag
  const escalateRiskFlag = useMutation({
    mutationFn: async ({ id, new_severity }: { id: string; new_severity?: string }) => {
      const updates: any = { status: 'escalated' };
      if (new_severity) {
        updates.risk_severity = new_severity;
      }

      const { data, error } = await supabase
        .from('supplier_risk_flags')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-risk-flags'] });
      queryClient.invalidateQueries({ queryKey: ['risk-flag-history'] });
      toast({
        title: "Risk flag escalated",
        description: "The risk flag has been escalated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error escalating risk flag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete risk flag
  const deleteRiskFlag = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('supplier_risk_flags')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-risk-flags'] });
      toast({
        title: "Risk flag deleted",
        description: "The risk flag has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting risk flag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    riskFlags,
    isLoading,
    error,
    createRiskFlag,
    updateRiskFlag,
    resolveRiskFlag,
    escalateRiskFlag,
    deleteRiskFlag,
  };
};

// Hook for risk flag history
export const useRiskFlagHistory = (riskFlagId: string) => {
  return useQuery({
    queryKey: ['risk-flag-history', riskFlagId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('risk_flag_history')
        .select('*')
        .eq('risk_flag_id', riskFlagId)
        .order('action_date', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!riskFlagId,
  });
};
