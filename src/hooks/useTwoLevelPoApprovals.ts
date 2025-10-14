import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCurrentUserRoles } from "./useCurrentUserRoles";

// Helper function to find department head
async function findDepartmentHead() {
  // First get the role ID for Department Head
  const rolesQuery = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'Department Head')
    .maybeSingle();
  
  if (!rolesQuery.data) {
    throw new Error("Department Head role not found");
  }

  const roleId = rolesQuery.data.id;

  // Then get users with that role
  const userRolesQuery = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role_id', roleId)
    .limit(1);

  if (!userRolesQuery.data || userRolesQuery.data.length === 0) {
    throw new Error("No department head found in the system");
  }

  const deptHeadUserId = userRolesQuery.data[0].user_id;

  // Get profile details
  const profileQuery = await supabase
    .from('profiles')
    .select('email')
    .eq('user_id', deptHeadUserId)
    .maybeSingle();

  if (!profileQuery.data?.email) {
    throw new Error("Department head email not found");
  }

  return {
    email: profileQuery.data.email,
    userId: deptHeadUserId
  };
}

interface ApproveAsMerchandiserParams {
  poId: string;
  comments?: string;
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
    mutationFn: async ({ poId, comments }: ApproveAsMerchandiserParams) => {
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

      // Query for Department Head users
      const deptHead = await findDepartmentHead();
      const deptHeadEmail = deptHead.email;
      const deptHeadId = deptHead.userId;

      if (!deptHeadEmail || !deptHeadId) {
        throw new Error("Department head email not found");
      }

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
