import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PoApproval, PoStatus } from '@/types/purchaseOrder';

// Submit PO for approval
export function useSubmitPurchaseOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const currentUser = await supabase.auth.getUser();
      
      // Update PO status to pending_approval
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({ status: 'pending_approval' })
        .eq('id', id);

      if (poError) throw poError;

      // Create approval record
      const { error: approvalError } = await supabase
        .from('po_approvals')
        .insert({
          po_id: id,
          approver_id: currentUser.data.user?.id!,
          action: 'pending_approval',
          comments: 'Submitted for approval'
        });

      if (approvalError) throw approvalError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({
        title: "Success",
        description: "Purchase Order submitted for approval",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit Purchase Order for approval",
        variant: "destructive",
      });
      console.error('Submit PO error:', error);
    },
  });
}

// Approve or reject PO
export function useApprovePurchaseOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      id, 
      action, 
      comments 
    }: { 
      id: string; 
      action: 'approved' | 'rejected'; 
      comments?: string; 
    }) => {
      const currentUser = await supabase.auth.getUser();
      
      // Update PO status and approval details
      const updateData: any = { 
        status: action,
        approved_by: currentUser.data.user?.id,
        approved_date: new Date().toISOString()
      };

      const { error: poError } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', id);

      if (poError) throw poError;

      // Create approval record
      const { error: approvalError } = await supabase
        .from('po_approvals')
        .insert({
          po_id: id,
          approver_id: currentUser.data.user?.id!,
          action: action as PoStatus,
          comments: comments
        });

      if (approvalError) throw approvalError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({
        title: "Success",
        description: `Purchase Order ${variables.action} successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to process approval",
        variant: "destructive",
      });
      console.error('Approve PO error:', error);
    },
  });
}

// Get PO approvals
export function usePurchaseOrderApprovals(poId: string) {
  return useQuery({
    queryKey: ['po-approvals', poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('po_approvals')
        .select(`*`)
        .eq('po_id', poId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PoApproval[];
    },
    enabled: !!poId,
  });
}