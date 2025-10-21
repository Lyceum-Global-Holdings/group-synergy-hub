import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

export interface ApproverAssignment {
  id: string;
  company_id: string;
  stage_order: number;
  user_id: string;
  role_required: string | null;
  is_backup: boolean;
  notification_enabled: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export function useApprovalAssignments(stageOrder?: number) {
  const { selectedCompany } = useCompany();

  return useQuery({
    queryKey: ['approver-assignments', selectedCompany?.id, stageOrder],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      let query = supabase
        .from('approver_assignments')
        .select('*')
        .eq('company_id', selectedCompany.id);

      if (stageOrder) {
        query = query.eq('stage_order', stageOrder);
      }

      const { data, error } = await query.order('is_backup', { ascending: true });

      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedCompany?.id,
  });
}

export function useCreateApproverAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignment: Omit<ApproverAssignment, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('approver_assignments')
        .insert(assignment)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approver-assignments'] });
      toast.success('Approver assigned successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign approver: ${error.message}`);
    },
  });
}

export function useDeleteApproverAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('approver_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approver-assignments'] });
      toast.success('Approver removed successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove approver: ${error.message}`);
    },
  });
}
