import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MaterialReturnNote, CreateMaterialReturnData, CreateMaterialReturnItemData } from '@/types/materialIssueReturn';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useLocationFilter } from '@/contexts/LocationFilterContext';

type CreateMaterialReturnWithItemsData = CreateMaterialReturnData & {
  items: Omit<CreateMaterialReturnItemData, 'mrn_id'>[];
};

export const useMaterialReturns = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { globalLocationId } = useLocationFilter();
  const companyId = selectedCompany?.id ?? null;

  const {
    data: materialReturns = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['material-returns', companyId, globalLocationId],
    enabled: !!companyId,
    queryFn: async () => {
      let query = supabase
        .from('material_return_notes')
        .select('*')
        .eq('company_id', companyId as string)
        .order('created_at', { ascending: false });

      if (globalLocationId) {
        query = query.eq('location_id', globalLocationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MaterialReturnNote[];
    }
  });

  // NOTE: The legacy header-only `createMaterialReturn` mutation was intentionally
  // removed. It allowed creating an MRN without items, which produced empty drafts
  // that could never be approved. All callers must use `createMaterialReturnWithItemsAsync`
  // which atomically inserts the header and its line items via an RPC.


  const createMaterialReturnWithItemsMutation = useMutation({
    mutationFn: async ({ items, ...returnData }: CreateMaterialReturnWithItemsData) => {
      if (!items.length) throw new Error('At least one return item is required');

      const { data, error } = await supabase.rpc('create_material_return_with_items' as any, {
        p_return_date: returnData.return_date,
        p_returned_by: returnData.returned_by,
        p_return_type: returnData.return_type,
        p_reason: returnData.reason,
        p_reference_type: returnData.reference_type ?? null,
        p_reference_id: returnData.reference_id ?? null,
        p_notes: returnData.notes ?? null,
        p_company_id: returnData.company_id ?? null,
        p_srn_number: returnData.srn_number ?? null,
        p_items: items,
        p_location_id: returnData.location_id ?? null,
      });

      if (error) throw error;
      return data as MaterialReturnNote;
    },
    onSuccess: (createdReturn) => {
      queryClient.invalidateQueries({ queryKey: ['material-returns'] });
      queryClient.invalidateQueries({ queryKey: ['material-return-items', createdReturn?.id] });
      toast({
        title: "Success",
        description: "Material return note created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating material return with items:', error);
      toast({
        title: "Error",
        description: "Failed to create material return note with items",
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

  const approveMaterialReturnMutation = useMutation({
    mutationFn: async ({ id }: { id: string; mrnNumber: string }) => {
      const { data, error } = await supabase.rpc('approve_material_return', {
        p_mrn_id: id,
      });

      if (error) throw error;
      return data as MaterialReturnNote;
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
    onError: (error: any) => {
      console.error('Error approving material return:', error);
      toast({
        title: "Error",
        description: error?.message ?? "Failed to approve material return",
        variant: "destructive",
      });
    }
  });

  const addMissingReturnItemsMutation = useMutation({
    mutationFn: async ({ mrnId, items }: { mrnId: string; items: Omit<CreateMaterialReturnItemData, 'mrn_id'>[] }) => {
      if (!items.length) throw new Error('At least one return item is required');

      const { data, error } = await supabase.rpc('add_missing_material_return_items' as any, {
        p_mrn_id: mrnId,
        p_items: items,
      });

      if (error) throw error;
      return data as number;
    },
    onSuccess: (_count, variables) => {
      queryClient.invalidateQueries({ queryKey: ['material-returns'] });
      queryClient.invalidateQueries({ queryKey: ['material-return-items', variables.mrnId] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['item-bin-allocations'] });
      toast({
        title: "Success",
        description: "Missing return items added successfully",
      });
    },
    onError: (error) => {
      console.error('Error adding missing return items:', error);
      toast({
        title: "Error",
        description: "Failed to add missing return items",
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
    createMaterialReturnWithItemsAsync: createMaterialReturnWithItemsMutation.mutateAsync,
    addMissingReturnItemsAsync: addMissingReturnItemsMutation.mutateAsync,
    updateMaterialReturn: updateMaterialReturnMutation.mutate,
    approveMaterialReturn: approveMaterialReturnMutation.mutate,
    deleteMaterialReturn: deleteMaterialReturnMutation.mutate,
    isCreating: createMaterialReturnWithItemsMutation.isPending,

    isUpdating: updateMaterialReturnMutation.isPending,
    isApproving: approveMaterialReturnMutation.isPending,
    isRepairing: addMissingReturnItemsMutation.isPending,
    isDeleting: deleteMaterialReturnMutation.isPending,
  };
};
