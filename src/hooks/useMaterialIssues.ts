import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MaterialIssueNote, CreateMaterialIssueData } from '@/types/materialIssueReturn';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useLocationFilter } from '@/contexts/LocationFilterContext';

export const useMaterialIssues = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const { globalLocationId } = useLocationFilter();
  const companyId = selectedCompany?.id ?? null;

  const {
    data: materialIssues = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['material-issues', companyId, globalLocationId],
    enabled: !!companyId,
    queryFn: async () => {
      let query = supabase
        .from('material_issue_notes')
        .select('*, warehouse_locations(name)')
        .eq('company_id', companyId as string)
        .order('created_at', { ascending: false });

      if (globalLocationId) {
        query = query.eq('location_id', globalLocationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MaterialIssueNote[];
    }
  });

  const createMaterialIssueMutation = useMutation({
    mutationFn: async (issueData: CreateMaterialIssueData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Generate MIN number
      const { data: minNumber, error: minError } = await supabase
        .rpc('generate_min_number');
      
      if (minError) throw minError;

      const { data, error } = await supabase
        .from('material_issue_notes')
        .insert({
          ...issueData,
          srn_number: issueData.srn_number?.trim() || null,
          min_number: minNumber,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-issues'] });
      toast({
        title: "Success",
        description: "Material issue note created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating material issue:', error);
      toast({
        title: "Error",
        description: "Failed to create material issue note",
        variant: "destructive",
      });
    }
  });

  const updateMaterialIssueMutation = useMutation({
    mutationFn: async ({ id, ...issueData }: Partial<MaterialIssueNote> & { id: string }) => {
      const { data, error } = await supabase
        .from('material_issue_notes')
        .update(issueData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-issues'] });
      toast({
        title: "Success",
        description: "Material issue note updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating material issue:', error);
      toast({
        title: "Error",
        description: "Failed to update material issue note",
        variant: "destructive",
      });
    }
  });

  const deleteMaterialIssueMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('material_issue_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-issues'] });
      toast({
        title: "Success",
        description: "Material issue note deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting material issue:', error);
      toast({
        title: "Error",
        description: "Failed to delete material issue note",
        variant: "destructive",
      });
    }
  });

  return {
    materialIssues,
    isLoading,
    error,
    createMaterialIssue: createMaterialIssueMutation.mutate,
    createMaterialIssueAsync: createMaterialIssueMutation.mutateAsync,
    updateMaterialIssue: updateMaterialIssueMutation.mutate,
    deleteMaterialIssue: deleteMaterialIssueMutation.mutate,
    isCreating: createMaterialIssueMutation.isPending,
    isUpdating: updateMaterialIssueMutation.isPending,
    isDeleting: deleteMaterialIssueMutation.isPending,
  };
};