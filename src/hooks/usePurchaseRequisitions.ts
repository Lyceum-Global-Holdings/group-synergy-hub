import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { PurchaseRequisition, CreatePrData, PrItem, PrStatus } from '@/types/procurement';

export const usePurchaseRequisitions = () => {
  return useQuery({
    queryKey: ['purchase-requisitions'],
    queryFn: async (): Promise<PurchaseRequisition[]> => {
      const { data, error } = await supabase
        .from('purchase_requisitions')
        .select(`
          *,
          items:pr_items(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch profile data separately
      const prs = data || [];
      const userIds = [...new Set([
        ...prs.map(pr => pr.requested_by),
        ...prs.map(pr => pr.approved_by).filter(Boolean)
      ])];

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);

        const profileMap = new Map(
          profiles?.map(p => [p.user_id, p]) || []
        );

        return prs.map(pr => ({
          ...pr,
          requested_by_profile: profileMap.get(pr.requested_by),
          approved_by_profile: pr.approved_by ? profileMap.get(pr.approved_by) : undefined,
        }));
      }

      return prs.map(pr => ({
        ...pr,
        requested_by_profile: undefined,
        approved_by_profile: undefined,
      }));
    },
  });
};

export const usePurchaseRequisition = (id: string) => {
  return useQuery({
    queryKey: ['purchase-requisition', id],
    queryFn: async (): Promise<PurchaseRequisition> => {
      const { data, error } = await supabase
        .from('purchase_requisitions')
        .select(`
          *,
          items:pr_items(*),
          approvals:pr_approvals(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch profile data separately
      const userIds = [
        data.requested_by,
        data.approved_by,
        ...(data.approvals?.map((a: any) => a.approver_id) || [])
      ].filter(Boolean);

      const uniqueUserIds = [...new Set(userIds)];

      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', uniqueUserIds);

        const profileMap = new Map(
          profiles?.map(p => [p.user_id, p]) || []
        );

        return {
          ...data,
          requested_by_profile: profileMap.get(data.requested_by),
          approved_by_profile: data.approved_by ? profileMap.get(data.approved_by) : undefined,
          approvals: data.approvals?.map((approval: any) => ({
            ...approval,
            approver_profile: profileMap.get(approval.approver_id),
          })),
        };
      }

      return {
        ...data,
        requested_by_profile: undefined,
        approved_by_profile: undefined,
      };
    },
    enabled: !!id,
  });
};

export const useCreatePurchaseRequisition = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreatePrData): Promise<PurchaseRequisition> => {
      if (!user?.id) throw new Error('User not authenticated');

      // Generate PR number
      const { data: prNumber, error: numberError } = await supabase
        .rpc('generate_pr_number');

      if (numberError) throw numberError;

      // Create the purchase requisition
      const { data: pr, error: prError } = await supabase
        .from('purchase_requisitions')
        .insert({
          pr_number: prNumber,
          title: data.title,
          description: data.description,
          requested_by: user.id,
          department: data.department,
          priority: data.priority,
          required_date: data.required_date,
          justification: data.justification,
          company_id: data.company_id,
        })
        .select()
        .single();

      if (prError) throw prError;

      // Add items if any
      if (data.items.length > 0) {
        const itemsToInsert = data.items.map(item => ({
          ...item,
          pr_id: pr.id,
        }));

        const { error: itemsError } = await supabase
          .from('pr_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return pr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      toast({
        title: 'Purchase Requisition Created',
        description: 'Your purchase requisition has been created successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error Creating Purchase Requisition',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
};

export const useUpdatePurchaseRequisition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PurchaseRequisition> }) => {
      const { error } = await supabase
        .from('purchase_requisitions')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-requisition', id] });
      toast({
        title: 'Purchase Requisition Updated',
        description: 'The purchase requisition has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error Updating Purchase Requisition',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
};

export const useSubmitPurchaseRequisition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('purchase_requisitions')
        .update({ status: 'submitted' })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      toast({
        title: 'Purchase Requisition Submitted',
        description: 'Your purchase requisition has been submitted for approval.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error Submitting Purchase Requisition',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
};

export const useApprovePurchaseRequisition = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, action, comments }: { id: string; action: 'approved' | 'rejected'; comments?: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Update PR status
      const updateData: any = { status: action };
      if (action === 'approved') {
        updateData.approved_by = user.id;
        updateData.approved_date = new Date().toISOString();
      } else if (action === 'rejected' && comments) {
        updateData.rejection_reason = comments;
      }

      const { error: updateError } = await supabase
        .from('purchase_requisitions')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;

      // Add approval record
      const { error: approvalError } = await supabase
        .from('pr_approvals')
        .insert({
          pr_id: id,
          approver_id: user.id,
          action,
          comments,
        });

      if (approvalError) throw approvalError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      toast({
        title: 'Purchase Requisition Processed',
        description: 'The purchase requisition has been processed successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error Processing Purchase Requisition',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
};

export const useDeletePurchaseRequisition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('purchase_requisitions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
      toast({
        title: 'Purchase Requisition Deleted',
        description: 'The purchase requisition has been deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error Deleting Purchase Requisition',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
};

// PR Items hooks
export const useAddPrItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: Omit<PrItem, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase
        .from('pr_items')
        .insert(item);

      if (error) throw error;
    },
    onSuccess: (_, item) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisition', item.pr_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
    },
  });
};

export const useUpdatePrItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, prId, data }: { id: string; prId: string; data: Partial<PrItem> }) => {
      const { error } = await supabase
        .from('pr_items')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      return prId;
    },
    onSuccess: (prId) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisition', prId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
    },
  });
};

export const useDeletePrItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, prId }: { id: string; prId: string }) => {
      const { error } = await supabase
        .from('pr_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return prId;
    },
    onSuccess: (prId) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requisition', prId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] });
    },
  });
};