import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCurrentUserRoles } from "./useCurrentUserRoles";

interface ApproveAsMerchandiserParams {
  poId: string;
  comments?: string;
  deptHeadEmail: string;
  deptHeadId: string;
}

interface ApproveAsDeptHeadParams {
  poId: string;
  comments?: string;
}

interface RejectPoParams {
  poId: string;
  reason: string;
  approvalLevel: 'merchandiser' | 'department_head';
}

export const useSubmitForMerchandiserApproval = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ poId }: { poId: string }) => {
      // Update PO status to pending_approval (merchandiser level)
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({ 
          status: 'pending_approval' as any,
          approval_level: 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', poId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({
        title: "Success",
        description: "PO submitted for merchandiser approval.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit PO for approval",
        variant: "destructive",
      });
    },
  });
};

export const useApprovePOAsMerchandiser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ poId, comments, deptHeadEmail, deptHeadId }: ApproveAsMerchandiserParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const userId = user.id;

      // Update PO with merchandiser approval
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          merchandiser_approved_by: userId,
          merchandiser_approved_date: new Date().toISOString(),
          merchandiser_comments: comments || null,
          status: 'pending_dept_head_approval' as any,
          approval_level: 2,
          updated_at: new Date().toISOString()
        })
        .eq('id', poId);

      if (updateError) throw updateError;

      // Create approval record
      await supabase
        .from('po_approvals')
        .insert({
          po_id: poId,
          approver_id: userId,
          action: 'approved',
          comments: comments || null,
          approval_level: 'merchandiser',
          approval_method: 'manual'
        });

      // Send email to department head
      const { data, error } = await supabase.functions.invoke('po-email-approval', {
        body: {
          action: 'send_email',
          po_id: poId,
          approver_email: deptHeadEmail,
          approver_id: deptHeadId,
          approval_level: 'department_head'
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({
        title: "Success",
        description: "PO approved as merchandiser. Email sent to Department Head.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve PO",
        variant: "destructive",
      });
    },
  });
};

export const useApprovePOAsDeptHead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ poId, comments }: ApproveAsDeptHeadParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const userId = user.id;

      // Final approval
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          department_head_approved_by: userId,
          department_head_approved_date: new Date().toISOString(),
          department_head_comments: comments || null,
          status: 'approved',
          approval_level: 3,
          approved_by: userId,
          approved_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', poId);

      if (updateError) throw updateError;

      // Create approval record
      await supabase
        .from('po_approvals')
        .insert({
          po_id: poId,
          approver_id: userId,
          action: 'approved',
          comments: comments || null,
          approval_level: 'department_head',
          approval_method: 'manual'
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({
        title: "Success",
        description: "PO fully approved. Ready to send to supplier.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve PO",
        variant: "destructive",
      });
    },
  });
};

export const useRejectPO = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ poId, reason, approvalLevel }: RejectPoParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const userId = user.id;

      // Reject PO
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', poId);

      if (updateError) throw updateError;

      // Create rejection record
      await supabase
        .from('po_approvals')
        .insert({
          po_id: poId,
          approver_id: userId,
          action: 'rejected',
          comments: reason,
          approval_level: approvalLevel,
          approval_method: 'manual'
        });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({
        title: "PO Rejected",
        description: "Purchase order has been rejected.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject PO",
        variant: "destructive",
      });
    },
  });
};
