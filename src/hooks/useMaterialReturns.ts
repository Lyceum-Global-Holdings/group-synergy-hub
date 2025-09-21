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
    deleteMaterialReturn: deleteMaterialReturnMutation.mutate,
    isCreating: createMaterialReturnMutation.isPending,
    isUpdating: updateMaterialReturnMutation.isPending,
    isDeleting: deleteMaterialReturnMutation.isPending,
  };
};