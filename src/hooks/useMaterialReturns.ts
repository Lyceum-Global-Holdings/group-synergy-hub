import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MaterialReturnNote, CreateMaterialReturnData } from '@/types/materialIssueReturn';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';

export const useMaterialReturns = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;

  const {
    data: materialReturns = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['material-returns', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_return_notes')
        .select('*')
        .eq('company_id', companyId as string)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MaterialReturnNote[];
    }
  });

  const createMaterialReturnMutation = useMutation({
    mutationFn: async (returnData: CreateMaterialReturnData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Generate MRN number
      const { data: mrnNumber, error: mrnError } = await supabase
        .rpc('generate_mrn_number');
      
      if (mrnError) throw mrnError;

      const { data, error } = await supabase
        .from('material_return_notes')
        .insert({
          ...returnData,
          srn_number: returnData.srn_number?.trim() || null,
          mrn_number: mrnNumber,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-returns'] });
      toast({
        title: "Success",
        description: "Material return note created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating material return:', error);
      toast({
        title: "Error",
        description: "Failed to create material return note",
        variant: "destructive",
      });
    }
  });

  const updateMaterialReturnMutation = useMutation({
    mutationFn: async ({ id, ...returnData }: Partial<MaterialReturnNote> & { id: string }) => {
      const { data, error } = await supabase
        .from('material_return_notes')
        .update(returnData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-returns'] });
      toast({
        title: "Success",
        description: "Material return note updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating material return:', error);
      toast({
        title: "Error",
        description: "Failed to update material return note",
        variant: "destructive",
      });
    }
  });

  // New mutation for approving returns with stock update
  const approveMaterialReturnMutation = useMutation({
    mutationFn: async ({ id, mrnNumber }: { id: string; mrnNumber: string }) => {
      console.log('[MaterialReturn] ===== STARTING APPROVAL PROCESS =====');
      console.log('[MaterialReturn] MRN ID:', id);
      console.log('[MaterialReturn] MRN Number:', mrnNumber);
      
      // Fetch MRN record to get company_id
      const { data: mrnRecord, error: mrnFetchError } = await supabase
        .from('material_return_notes')
        .select('company_id')
        .eq('id', id)
        .single();

      if (mrnFetchError) {
        console.error('[MaterialReturn] ERROR fetching MRN record:', mrnFetchError);
        throw mrnFetchError;
      }
      const mrnCompanyId = mrnRecord?.company_id;
      console.log('[MaterialReturn] MRN Company ID:', mrnCompanyId);

      // First, get the return items
      console.log('[MaterialReturn] Fetching return items...');
      const { data: returnItems, error: itemsError } = await supabase
        .from('material_return_items')
        .select('*')
        .eq('mrn_id', id);

      if (itemsError) {
        console.error('[MaterialReturn] ERROR fetching return items:', itemsError);
        throw itemsError;
      }
      
      console.log('[MaterialReturn] Return items found:', returnItems?.length || 0);
      console.log('[MaterialReturn] Return items data:', JSON.stringify(returnItems, null, 2));

      if (!returnItems || returnItems.length === 0) {
        console.warn('[MaterialReturn] WARNING: No return items found!');
      }

      // Process stock updates for each item
      for (const item of returnItems || []) {
        console.log('[MaterialReturn] ----- Processing item -----');
        console.log('[MaterialReturn] Item ID:', item.item_id);
        console.log('[MaterialReturn] Quantity returned:', item.quantity_returned);
        
        // Find bin allocation for the item
        console.log('[MaterialReturn] Looking for bin allocation...');
        const binQuery = supabase
          .from('warehouse_bin_allocations')
          .select('id')
          .eq('warehouse_item_id', item.item_id);
        
        if (mrnCompanyId) {
          binQuery.eq('company_id', mrnCompanyId);
        }

        const { data: binAllocation, error: binError } = await binQuery
          .limit(1)
          .maybeSingle();

        if (binError) {
          console.warn('[MaterialReturn] Warning getting bin allocation:', binError);
        }
        
        console.log('[MaterialReturn] Bin allocation found:', binAllocation?.id || 'NONE');

        // Call the RPC to update stock
        console.log('[MaterialReturn] Calling RPC process_material_return_stock_update with params:', {
          p_item_id: item.item_id,
          p_quantity_returned: item.quantity_returned,
          p_bin_allocation_id: binAllocation?.id || null,
          p_mrn_id: id,
          p_mrn_number: mrnNumber,
          p_company_id: mrnCompanyId || null
        });
        
        const { data: rpcResult, error: rpcError } = await supabase.rpc('process_material_return_stock_update', {
          p_item_id: item.item_id,
          p_quantity_returned: item.quantity_returned,
          p_bin_allocation_id: binAllocation?.id || null,
          p_mrn_id: id,
          p_mrn_number: mrnNumber,
          p_company_id: mrnCompanyId || null,
          p_secondary_quantity_returned: (item as any).secondary_quantity_returned ?? null,
        } as any);

        if (rpcError) {
          console.error('[MaterialReturn] RPC ERROR for item:', item.item_id);
          console.error('[MaterialReturn] RPC Error details:', JSON.stringify(rpcError, null, 2));
          throw rpcError;
        }
        
        console.log('[MaterialReturn] RPC SUCCESS for item:', item.item_id);
        console.log('[MaterialReturn] RPC Result:', rpcResult);
      }

      // Update the return note status to 'returned'
      console.log('[MaterialReturn] Updating MRN status to "returned"...');
      const { data, error } = await supabase
        .from('material_return_notes')
        .update({ status: 'returned' })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[MaterialReturn] ERROR updating MRN status:', error);
        throw error;
      }
      
      console.log('[MaterialReturn] ===== APPROVAL COMPLETE =====');
      console.log('[MaterialReturn] Updated MRN:', data);
      return data;
    },
    onSuccess: () => {
      console.log('[MaterialReturn] onSuccess - Invalidating queries...');
      queryClient.invalidateQueries({ queryKey: ['material-returns'] });
      queryClient.invalidateQueries({ queryKey: ['material-return-items'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['item-bin-allocations'] });
      toast({
        title: "Success",
        description: "Material return approved and stock updated",
      });
    },
    onError: (error) => {
      console.error('[MaterialReturn] onError - Approval failed:', error);
      toast({
        title: "Error",
        description: "Failed to approve material return",
        variant: "destructive",
      });
    }
  });

  const deleteMaterialReturnMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('material_return_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-returns'] });
      toast({
        title: "Success",
        description: "Material return note deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting material return:', error);
      toast({
        title: "Error",
        description: "Failed to delete material return note",
        variant: "destructive",
      });
    }
  });

  return {
    materialReturns,
    isLoading,
    error,
    createMaterialReturn: createMaterialReturnMutation.mutate,
    createMaterialReturnAsync: createMaterialReturnMutation.mutateAsync,
    updateMaterialReturn: updateMaterialReturnMutation.mutate,
    approveMaterialReturn: approveMaterialReturnMutation.mutate,
    deleteMaterialReturn: deleteMaterialReturnMutation.mutate,
    isCreating: createMaterialReturnMutation.isPending,
    isUpdating: updateMaterialReturnMutation.isPending,
    isApproving: approveMaterialReturnMutation.isPending,
    isDeleting: deleteMaterialReturnMutation.isPending,
  };
};
