import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { toast } from "sonner";
import { ApprovalWorkflowEngine } from "@/lib/approvalWorkflow";
import { useCompany } from "@/contexts/CompanyContext";

export interface WorkflowEntry {
  id: string;
  registration_request_id: string;
  stage: string;
  stage_order: number | null;
  status: string;
  assigned_to: string | null;
  completed_by: string | null;
  completed_at: string | null;
  approval_action: string | null;
  approval_comments: string | null;
  documents_verified: boolean;
  notified_at: string | null;
  escalated_to: string | null;
  notes: string | null;
  time_spent_hours: number | null;
  created_at: string;
  approver?: {
    full_name: string;
    email: string;
  };
  assigned_user?: {
    full_name: string;
    email: string;
  };
}

export function useWorkflowHistory(registrationId: string) {
  return useQuery({
    queryKey: ['workflow-history', registrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_approval_workflow')
        .select('*')
        .eq('registration_request_id', registrationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as WorkflowEntry[];
    },
    enabled: !!registrationId,
  });
}

export function useMyPendingApprovals() {
  return useQuery({
    queryKey: ['my-pending-approvals'],
    queryFn: async () => {
      const user = getCachedUser();
      if (!user) return [];

      // Get registrations with pending workflow entries assigned to current user
      const { data, error } = await supabase
        .from('supplier_approval_workflow')
        .select(`
          *,
          registration:supplier_registration_requests!inner(*)
        `)
        .eq('status', 'pending')
        .eq('assigned_to', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useApproveStage() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async ({
      registrationId,
      stageOrder,
      action,
      comments,
    }: {
      registrationId: string;
      stageOrder: number;
      action: 'approve' | 'reject' | 'request_info';
      comments: string;
    }) => {
      const user = getCachedUser();
      if (!user) throw new Error('Not authenticated');
      if (!selectedCompany) throw new Error('No company selected');

      // Get current workflow entry
      const { data: workflowEntry } = await supabase
        .from('supplier_approval_workflow')
        .select('*')
        .eq('registration_request_id', registrationId)
        .eq('stage_order', stageOrder)
        .eq('status', 'pending')
        .single();

      if (!workflowEntry) throw new Error('Workflow entry not found');

      // Verify user is assigned or has permission
      if (workflowEntry.assigned_to !== user.id) {
        // Check if user has admin role
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('roles!inner(name)')
          .eq('user_id', user.id)
          .single();

        if (userRole?.roles?.name !== 'admin') {
          throw new Error('Not authorized to approve this stage');
        }
      }

      const startTime = new Date(workflowEntry.created_at);
      const endTime = new Date();
      const timeSpentHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      // Update workflow entry
      await supabase
        .from('supplier_approval_workflow')
        .update({
          status: 'completed',
          completed_by: user.id,
          completed_at: endTime.toISOString(),
          approval_action: action,
          approval_comments: comments,
          time_spent_hours: Math.round(timeSpentHours * 100) / 100,
        })
        .eq('id', workflowEntry.id);

      if (action === 'approve') {
        // Move to next stage
        const workflow = new ApprovalWorkflowEngine();
        await workflow.moveToNextStage(registrationId, stageOrder, selectedCompany.id);
      } else if (action === 'reject') {
        // Update registration status
        await supabase
          .from('supplier_registration_requests')
          .update({
            status: 'rejected',
            rejection_reason: comments,
            reviewed_by: user.id,
            reviewed_at: endTime.toISOString(),
          })
          .eq('id', registrationId);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-history', variables.registrationId] });
      queryClient.invalidateQueries({ queryKey: ['my-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-registrations'] });
      
      const actionText = variables.action === 'approve' ? 'approved' : 
                        variables.action === 'reject' ? 'rejected' : 'updated';
      toast.success(`Registration ${actionText} successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to process approval: ${error.message}`);
    },
  });
}

export function useInitializeWorkflow() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  return useMutation({
    mutationFn: async (registrationId: string) => {
      if (!selectedCompany) throw new Error('No company selected');

      const workflow = new ApprovalWorkflowEngine();
      await workflow.initializeWorkflow(registrationId, selectedCompany.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-history'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-registrations'] });
      toast.success('Approval workflow initiated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to initialize workflow: ${error.message}`);
    },
  });
}
