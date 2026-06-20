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

  // --- Approval workflow (ISO 9001 §8.5.1 / SAP MIGO 261) ---
  const invalidateAfterApproval = () => {
    queryClient.invalidateQueries({ queryKey: ['material-issues'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-stock-movements'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-reservations'] });
    queryClient.invalidateQueries({ queryKey: ['approval-console'] });
  };

  const submitForApprovalMutation = useMutation({
    mutationFn: async (minId: string) => {
      const { data, error } = await supabase.rpc('submit_material_issue_for_approval', { p_min_id: minId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAfterApproval();
      toast({ title: 'Submitted for approval', description: 'An admin will review this MIN.' });
    },
    onError: (error: any) => {
      toast({ title: 'Submit failed', description: error?.message ?? 'Could not submit MIN.', variant: 'destructive' });
    },
  });

  const approveMaterialIssueMutation = useMutation({
    mutationFn: async (minId: string) => {
      const { data, error } = await supabase.rpc('approve_material_issue', { p_min_id: minId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAfterApproval();
      toast({ title: 'Approved', description: 'Stock has been issued.' });
    },
    onError: (error: any) => {
      toast({ title: 'Approval failed', description: error?.message ?? 'Could not approve MIN.', variant: 'destructive' });
    },
  });

  const reopenDraftMutation = useMutation({
    mutationFn: async (minId: string) => {
      const { data, error } = await supabase.rpc('reopen_material_issue_draft' as any, { p_min_id: minId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAfterApproval();
      toast({ title: 'Reopened as draft', description: 'You can now edit and resubmit this MIN.' });
    },
    onError: (error: any) => {
      toast({ title: 'Reopen failed', description: error?.message ?? 'Could not reopen MIN.', variant: 'destructive' });
    },
  });

  const rejectMaterialIssueMutation = useMutation({
    mutationFn: async ({ minId, reason }: { minId: string; reason: string }) => {
      const { data, error } = await supabase.rpc('reject_material_issue', { p_min_id: minId, p_reason: reason });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAfterApproval();
      toast({ title: 'Rejected', description: 'The MIN has been rejected.' });
    },
    onError: (error: any) => {
      toast({ title: 'Rejection failed', description: error?.message ?? 'Could not reject MIN.', variant: 'destructive' });
    },
  });

  return {
    materialIssues,
    isLoading,
    error,
    createMaterialIssue: createMaterialIssueMutation.mutate,
    createMaterialIssueAsync: createMaterialIssueMutation.mutateAsync,
    updateMaterialIssue: updateMaterialIssueMutation.mutate,
    deleteMaterialIssue: deleteMaterialIssueMutation.mutate,
    submitForApprovalAsync: submitForApprovalMutation.mutateAsync,
    approveMaterialIssue: approveMaterialIssueMutation.mutate,
    approveMaterialIssueAsync: approveMaterialIssueMutation.mutateAsync,
    rejectMaterialIssue: rejectMaterialIssueMutation.mutate,
    rejectMaterialIssueAsync: rejectMaterialIssueMutation.mutateAsync,
    isCreating: createMaterialIssueMutation.isPending,
    isUpdating: updateMaterialIssueMutation.isPending,
    isDeleting: deleteMaterialIssueMutation.isPending,
    isSubmitting: submitForApprovalMutation.isPending,
    isApproving: approveMaterialIssueMutation.isPending,
    isRejecting: rejectMaterialIssueMutation.isPending,
  };
};