import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  AssetRequest, 
  AssetRequestItem, 
  CreateAssetRequestData,
  CreateAssetRequestItemData,
  ApproveAssetRequestData,
  AssetRequestStatus,
  MarkAsDeliveredData,
  ConfirmReceiptData,
  WorkflowHistoryEntry,
  AssetRequestDelivery
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

      // If procurement approval and item adjustments provided, update quantities
      if (approvalData.approval_level === 'procurement' && approvalData.item_adjustments) {
        const adjustments = Object.entries(approvalData.item_adjustments);
        for (const [itemId, approvedQty] of adjustments) {
          await supabase
            .from('asset_request_items')
            .update({ 
              quantity_approved: approvedQty,
              status: approvalData.action === 'approved' ? 'approved' : 'rejected'
            })
            .eq('id', itemId);
        }
      }

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
    onSuccess: (_, variables) => {
      // Invalidate all asset request queries regardless of filters
      queryClient.invalidateQueries({ queryKey: ['asset-requests'] });
      queryClient.invalidateQueries({ queryKey: ['asset-request-items'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-history'] });
      
      const action = variables.action;
      const level = variables.approval_level;
      
      toast({
        title: "Success",
        description: action === 'approved' 
          ? level === 'procurement'
            ? "Request approved and ready for delivery!"
            : "Request approved. Forwarded to Procurement for final review."
          : action === 'rejected' 
          ? "Request rejected" 
          : "Changes requested successfully",
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
      queryClient.invalidateQueries({ queryKey: ['workflow-history'] });
      toast({
        title: "Success",
        description: "Request submitted for HOD approval",
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

  // Confirm purchase (after procurement approval)
  const confirmPurchaseMutation = useMutation({
    mutationFn: async (data: { 
      request_id: string; 
      purchase_date: string; 
      purchase_notes?: string;
      item_details?: Array<{
        item_id: string;
        vendor: string | null;
        po_reference: string | null;
      }>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Update request status to purchased
      const { error: updateError } = await supabase
        .from('asset_requests')
        .update({ 
          status: 'purchased',
          purchased_date: data.purchase_date,
          purchased_by: user.id,
          purchase_notes: data.purchase_notes
        })
        .eq('id', data.request_id);

      if (updateError) throw updateError;

      // Create workflow history entry
      const { error: historyError } = await supabase
        .from('asset_request_workflow_history')
        .insert({
          request_id: data.request_id,
          workflow_stage: 'items_purchased',
          performed_by: user.id,
          comments: data.purchase_notes || 'Items purchased and ready for delivery'
        });

      if (historyError) throw historyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-requests'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-history'] });
      toast({
        title: "Success",
        description: "Purchase confirmed. Items are ready for delivery.",
      });
    },
    onError: (error) => {
      console.error('Error confirming purchase:', error);
      toast({
        title: "Error",
        description: "Failed to confirm purchase",
        variant: "destructive",
      });
    }
  });

  // Mark as delivered
  const markAsDeliveredMutation = useMutation({
    mutationFn: async (data: MarkAsDeliveredData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create delivery record
      const { data: delivery, error: deliveryError } = await supabase
        .from('asset_request_deliveries')
        .insert({
          request_id: data.request_id,
          delivered_by: user.id,
          delivery_date: new Date().toISOString().split('T')[0],
          delivery_location: data.delivery_location,
          delivery_notes: data.delivery_notes,
          status: 'pending_receipt',
        })
        .select()
        .single();

      if (deliveryError) throw deliveryError;

      // Create delivery items
      const deliveryItems = data.items.map(item => ({
        delivery_id: delivery.id,
        request_item_id: item.request_item_id,
        quantity_delivered: item.quantity_delivered,
        delivery_notes: item.delivery_notes,
      }));

      const { error: itemsError } = await supabase
        .from('asset_request_delivery_items')
        .insert(deliveryItems);

      if (itemsError) throw itemsError;

      // Update request status
      const { error: statusError } = await supabase
        .from('asset_requests')
        .update({ status: 'pending_receipt' })
        .eq('id', data.request_id);

      if (statusError) throw statusError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-requests'] });
      queryClient.invalidateQueries({ queryKey: ['asset-request-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-history'] });
      toast({
        title: "Success",
        description: "Items marked as delivered. Awaiting receipt confirmation.",
      });
    },
    onError: (error) => {
      console.error('Error marking as delivered:', error);
      toast({
        title: "Error",
        description: "Failed to mark items as delivered",
        variant: "destructive",
      });
    }
  });

  // Confirm receipt
  const confirmReceiptMutation = useMutation({
    mutationFn: async (data: ConfirmReceiptData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Step 1: Update delivery items with received quantities
      for (const item of data.items) {
        await supabase
          .from('asset_request_delivery_items')
          .update({
            quantity_received: item.quantity_received,
            receipt_notes: item.receipt_notes,
            received_at: new Date().toISOString(),
            received_by: user.id,
          })
          .eq('id', item.delivery_item_id);

        // Update request items with fulfilled quantity
        await supabase
          .from('asset_request_items')
          .update({
            quantity_fulfilled: item.quantity_received,
            status: item.quantity_received > 0 ? 'fulfilled' : 'pending',
          })
          .eq('id', item.request_item_id);
      }

      // Step 2: Update delivery status
      await supabase
        .from('asset_request_deliveries')
        .update({
          status: 'fully_received',
        })
        .eq('id', data.delivery_id);

      // Step 3: Call create_assets_from_request to create assets in main warehouse
      console.log('Creating assets from request:', data.request_id);
      const { data: createResult, error: createError } = await supabase
        .rpc('create_assets_from_request', {
          p_request_id: data.request_id
        });

      if (createError) {
        console.error('Error creating assets:', createError);
        throw new Error(`Failed to create assets: ${createError.message}`);
      }

      const createResultData = createResult as any;
      if (!createResultData || !createResultData.success) {
        throw new Error(createResultData?.error || 'Failed to create assets');
      }

      console.log('Assets created:', createResultData);

      // Step 4: Call transfer_assets_to_department to move assets to department
      console.log('Transferring assets to department:', data.request_id);
      const { data: transferResult, error: transferError } = await supabase
        .rpc('transfer_assets_to_department', {
          p_request_id: data.request_id
        });

      if (transferError) {
        console.error('Error transferring assets:', transferError);
        throw new Error(`Failed to transfer assets: ${transferError.message}`);
      }

      const transferResultData = transferResult as any;
      if (!transferResultData || !transferResultData.success) {
        throw new Error(transferResultData?.error || 'Failed to transfer assets to department');
      }

      console.log('Assets transferred:', transferResultData);

      // Return success with details
      return {
        success: true,
        assetsCreated: createResultData.assets_created || 0,
        assetsTransferred: transferResultData.assets_transferred || 0,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['asset-requests'] });
      queryClient.invalidateQueries({ queryKey: ['asset-request-items'] });
      queryClient.invalidateQueries({ queryKey: ['asset-request-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-history'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-transfers'] });
      
      const message = result?.assetsCreated 
        ? `Receipt confirmed. ${result.assetsCreated} assets created and ${result.assetsTransferred || 0} transferred to department.`
        : "Receipt confirmed successfully";
      
      toast({
        title: "Success",
        description: message,
      });
    },
    onError: (error) => {
      console.error('Error confirming receipt:', error);
      toast({
        title: "Error",
        description: "Failed to confirm receipt",
        variant: "destructive",
      });
    }
  });

  // Get workflow history
  const useWorkflowHistory = (requestId: string | undefined) => {
    return useQuery({
      queryKey: ['workflow-history', requestId],
      queryFn: async () => {
        if (!requestId) return [];
        const { data, error } = await supabase
          .from('asset_request_workflow_history')
          .select('*')
          .eq('request_id', requestId)
          .order('performed_at', { ascending: true });

        if (error) throw error;
        return data as WorkflowHistoryEntry[];
      },
      enabled: !!requestId,
    });
  };

  // Get deliveries for request
  const useRequestDeliveries = (requestId: string | undefined) => {
    return useQuery({
      queryKey: ['asset-request-deliveries', requestId],
      queryFn: async () => {
        if (!requestId) return [];
        const { data, error } = await supabase
          .from('asset_request_deliveries')
          .select(`
            *,
            delivery_items:asset_request_delivery_items(
              *,
              request_item:asset_request_items(*)
            )
          `)
          .eq('request_id', requestId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data as AssetRequestDelivery[];
      },
      enabled: !!requestId,
    });
  };

  return {
    assetRequests,
    isLoading,
    error,
    useAssetRequestItems,
    useWorkflowHistory,
    useRequestDeliveries,
    createAssetRequest: createAssetRequestMutation.mutate,
    updateAssetRequest: updateAssetRequestMutation.mutate,
    deleteAssetRequest: deleteAssetRequestMutation.mutate,
    createAssetRequestItem: createAssetRequestItemMutation.mutate,
    updateAssetRequestItem: updateAssetRequestItemMutation.mutate,
    deleteAssetRequestItem: deleteAssetRequestItemMutation.mutate,
    approveAssetRequest: approveAssetRequestMutation.mutate,
    submitAssetRequest: submitAssetRequestMutation.mutate,
    confirmPurchase: confirmPurchaseMutation.mutate,
    markAsDelivered: markAsDeliveredMutation.mutate,
    confirmReceipt: confirmReceiptMutation.mutate,
    isCreating: createAssetRequestMutation.isPending,
    isUpdating: updateAssetRequestMutation.isPending,
    isDeleting: deleteAssetRequestMutation.isPending,
    isCreatingItem: createAssetRequestItemMutation.isPending,
    isUpdatingItem: updateAssetRequestItemMutation.isPending,
    isDeletingItem: deleteAssetRequestItemMutation.isPending,
    isApproving: approveAssetRequestMutation.isPending,
    isSubmitting: submitAssetRequestMutation.isPending,
    isConfirmingPurchase: confirmPurchaseMutation.isPending,
    isMarkingAsDelivered: markAsDeliveredMutation.isPending,
    isConfirmingReceipt: confirmReceiptMutation.isPending,
  };
};
