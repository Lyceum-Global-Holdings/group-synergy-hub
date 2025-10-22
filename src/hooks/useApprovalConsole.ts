import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UnifiedApproval, ApprovalFilters, ApprovalPriority } from "@/types/approval";
import { differenceInDays } from "date-fns";

/**
 * Hook to fetch and manage all pending approvals for the approval console
 * Uses secure database function to aggregate all approval sources
 */
export const useApprovalConsole = (filters?: ApprovalFilters) => {
  return useQuery({
    queryKey: ['approval-console', filters],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Call the secure database function to get all approvals
      const { data: rawApprovals, error } = await supabase
        .rpc('get_approval_console', { user_id: user.id });

      if (error) {
        console.error('Error fetching approvals:', error);
        throw error;
      }

      // Transform the raw data to UnifiedApproval format
      const allApprovals: UnifiedApproval[] = (rawApprovals || []).map(approval => {
        const createdDate = new Date(approval.created_at);
        const ageDays = differenceInDays(new Date(), createdDate);
        
        return {
          id: approval.id,
          type: approval.type as any,
          title: approval.title,
          description: approval.description,
          priority: approval.priority_text as ApprovalPriority,
          status: approval.status_text as any,
          assigned_to: approval.assigned_to,
          assigned_to_name: approval.assigned_to_name,
          stage: approval.stage,
          stage_order: approval.stage_order,
          created_at: approval.created_at,
          age_days: ageDays,
          sla_deadline: null,
          is_overdue: ageDays > 3,
          amount: approval.amount,
          currency: approval.currency,
          entity_id: approval.entity_id,
          entity_data: approval.entity_data,
          can_approve: true,
          can_reject: true,
          can_request_info: false,
          requires_comments: false,
          view_url: approval.view_url
        };
      });

      // Apply filters
      let filtered = allApprovals;

      if (filters?.type) {
        filtered = filtered.filter(a => a.type === filters.type);
      }

      if (filters?.priority) {
        filtered = filtered.filter(a => a.priority === filters.priority);
      }

      if (filters?.status) {
        filtered = filtered.filter(a => a.status === filters.status);
      }

      if (filters?.overdue) {
        filtered = filtered.filter(a => a.is_overdue);
      }

      if (filters?.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        filtered = filtered.filter(a =>
          a.title.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query)
        );
      }

      // Sort by priority and age
      filtered.sort((a, b) => {
        const priorityWeight: Record<ApprovalPriority, number> = {
          urgent: 4, high: 3, medium: 2, low: 1
        };
        const aPriority = priorityWeight[a.priority];
        const bPriority = priorityWeight[b.priority];

        if (aPriority !== bPriority) return bPriority - aPriority;
        return b.age_days - a.age_days;
      });

      return filtered;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};
