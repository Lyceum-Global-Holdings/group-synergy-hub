import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  AssetRequest, 
  AssetRequestItem, 
  CreateAssetRequestData,
  CreateAssetRequestItemData,
  ApproveAssetRequestData,
  AssetRequestStatus
} from '@/types/assetRequest';

export const useAssetRequests = (filters?: { status?: AssetRequestStatus }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all asset requests
  const {
    data: assetRequests = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['asset-requests', filters],
    queryFn: async () => {
      let query = supabase
        .from('asset_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AssetRequest[];
    }
  });

  // Fetch asset request items
  const useAssetRequestItems = (requestId: string | undefined) => {
    return useQuery({
      queryKey: ['asset-request-items', requestId],
      queryFn: async () => {
        if (!requestId) return [];
        
        const { data, error } = await supabase
          .from('asset_request_items')
          .select(`
            *,
            asset_master (*),
            asset_categories!category_id (*)
          `)
          .eq('request_id', requestId)
          .order('line_number', { ascending: true });

        if (error) throw error;
        return data as AssetRequestItem[];
      },
      enabled: !!requestId
    });
  };

  // Create asset request
  const createAssetRequestMutation = useMutation({
    mutationFn: async (requestData: CreateAssetRequestData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('asset_requests')
        .insert({
          ...requestData,
          requested_by: user.id,
          created_by: user.id
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-requests'] });
      toast({
        title: "Success",
        description: "Asset request created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating asset request:', error);
      toast({
        title: "Error",
        description: "Failed to create asset request",
        variant: "destructive",
      });
    }
  });

  // Update asset request
  const updateAssetRequestMutation = useMutation({
    mutationFn: async ({ id, ...requestData }: Partial<AssetRequest> & { id: string }) => {
      const { data, error } = await supabase
        .from('asset_requests')
        .update(requestData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-requests'] });
      toast({
        title: "Success",
        description: "Asset request updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating asset request:', error);
      toast({
        title: "Error",
        description: "Failed to update asset request",
        variant: "destructive",
      });
    }
  });

  // Delete asset request
  const deleteAssetRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('asset_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-requests'] });
      toast({
        title: "Success",
        description: "Asset request deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting asset request:', error);
      toast({
        title: "Error",
        description: "Failed to delete asset request",
        variant: "destructive",
      });
    }
  });

  // Create asset request item
  const createAssetRequestItemMutation = useMutation({
    mutationFn: async (itemData: CreateAssetRequestItemData) => {
      const { data, error } = await supabase
        .from('asset_request_items')
        .insert(itemData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['asset-request-items', variables.request_id] });
      queryClient.invalidateQueries({ queryKey: ['asset-requests'] });
      toast({
        title: "Success",
        description: "Item added to request",
      });
    },
    onError: (error) => {
      console.error('Error creating asset request item:', error);
      toast({
        title: "Error",
        description: "Failed to add item to request",
        variant: "destructive",
      });
    }
  });

  // Update asset request item
  const updateAssetRequestItemMutation = useMutation({
    mutationFn: async ({ id, ...itemData }: Partial<AssetRequestItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('asset_request_items')
        .update(itemData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['asset-request-items', data.request_id] });
      queryClient.invalidateQueries({ queryKey: ['asset-requests'] });
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating asset request item:', error);
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive",
      });
    }
  });

  // Delete asset request item
  const deleteAssetRequestItemMutation = useMutation({
    mutationFn: async ({ id, request_id }: { id: string; request_id: string }) => {
      const { error } = await supabase
        .from('asset_request_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { request_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['asset-request-items', data.request_id] });
      queryClient.invalidateQueries({ queryKey: ['asset-requests'] });
      toast({
        title: "Success",
        description: "Item removed from request",
      });
    },
    onError: (error) => {
      console.error('Error deleting asset request item:', error);
      toast({
        title: "Error",
        description: "Failed to remove item",
        variant: "destructive",
      });
    }
  });

  // Approve/Reject asset request
  const approveAssetRequestMutation = useMutation({
    mutationFn: async (approvalData: ApproveAssetRequestData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create approval record
      const { error: approvalError } = await supabase
        .from('asset_request_approvals')
        .insert({
          request_id: approvalData.request_id,
          approver_id: user.id,
          approval_level: approvalData.approval_level,
          action: approvalData.action,
          comments: approvalData.comments
        });

      if (approvalError) throw approvalError;

      // Update request status
      let newStatus: AssetRequestStatus;
      let updateFields: any = {};

      if (approvalData.approval_level === 'hod') {
        if (approvalData.action === 'approved') {
          newStatus = 'pending_procurement_approval';
          updateFields = {
            hod_approved_by: user.id,
            hod_approval_date: new Date().toISOString(),
            hod_comments: approvalData.comments
          };
        } else {
          newStatus = 'rejected';
          updateFields = {
            rejection_reason: approvalData.comments
          };
        }
      } else if (approvalData.approval_level === 'procurement') {
        if (approvalData.action === 'approved') {
          newStatus = 'approved';
          updateFields = {
            procurement_approved_by: user.id,
            procurement_approval_date: new Date().toISOString(),
            procurement_comments: approvalData.comments
          };
        } else {
          newStatus = 'rejected';
          updateFields = {
            rejection_reason: approvalData.comments
          };
        }
      } else {
        newStatus = approvalData.action === 'approved' ? 'approved' : 'rejected';
      }

      const { error: updateError } = await supabase
        .from('asset_requests')
        .update({
          status: newStatus,
          ...updateFields
        })
        .eq('id', approvalData.request_id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-requests'] });
      toast({
        title: "Success",
        description: "Request approval action completed",
      });
    },
    onError: (error) => {
      console.error('Error processing approval:', error);
      toast({
        title: "Error",
        description: "Failed to process approval",
        variant: "destructive",
      });
    }
  });

  // Submit request (change from draft to pending)
  const submitAssetRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from('asset_requests')
        .update({ status: 'pending_hod_approval' })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-requests'] });
      toast({
        title: "Success",
        description: "Request submitted for approval",
      });
    },
    onError: (error) => {
      console.error('Error submitting request:', error);
      toast({
        title: "Error",
        description: "Failed to submit request",
        variant: "destructive",
      });
    }
  });

  return {
    assetRequests,
    isLoading,
    error,
    useAssetRequestItems,
    createAssetRequest: createAssetRequestMutation.mutate,
    updateAssetRequest: updateAssetRequestMutation.mutate,
    deleteAssetRequest: deleteAssetRequestMutation.mutate,
    createAssetRequestItem: createAssetRequestItemMutation.mutate,
    updateAssetRequestItem: updateAssetRequestItemMutation.mutate,
    deleteAssetRequestItem: deleteAssetRequestItemMutation.mutate,
    approveAssetRequest: approveAssetRequestMutation.mutate,
    submitAssetRequest: submitAssetRequestMutation.mutate,
    isCreating: createAssetRequestMutation.isPending,
    isUpdating: updateAssetRequestMutation.isPending,
    isDeleting: deleteAssetRequestMutation.isPending,
    isApproving: approveAssetRequestMutation.isPending,
    isSubmitting: submitAssetRequestMutation.isPending,
  };
};
