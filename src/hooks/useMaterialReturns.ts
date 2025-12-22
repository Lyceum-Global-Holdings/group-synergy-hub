import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MaterialReturnNote, CreateMaterialReturnData } from '@/types/materialIssueReturn';
import { useToast } from '@/hooks/use-toast';

export const useMaterialReturns = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: materialReturns = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['material-returns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_return_notes')
        .select('*')
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
      // First, get the return items
      const { data: returnItems, error: itemsError } = await supabase
        .from('material_return_items')
        .select('*')
        .eq('mrn_id', id);

      if (itemsError) throw itemsError;

      // Process stock updates for each item
      for (const item of returnItems || []) {
        // Find bin allocation for the item
        const { data: binAllocation } = await supabase
          .from('warehouse_bin_allocations')
          .select('id')
          .eq('warehouse_item_id', item.item_id)
          .limit(1)
          .maybeSingle();

        // Call the RPC to update stock
        const { error: rpcError } = await supabase.rpc('process_material_return_stock_update', {
          p_item_id: item.item_id,
          p_quantity_returned: item.quantity_returned,
          p_bin_allocation_id: binAllocation?.id || null,
          p_mrn_id: id,
          p_mrn_number: mrnNumber
        });

        if (rpcError) {
          console.error('Error processing stock update for item:', item.item_id, rpcError);
          throw rpcError;
        }
      }

      // Update the return note status to 'returned'
      const { data, error } = await supabase
        .from('material_return_notes')
        .update({ status: 'returned' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
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
      console.error('Error approving material return:', error);
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
