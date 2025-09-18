import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Company, CreateCompanyData, UpdateCompanyData } from '@/types/company';
import { useToast } from '@/hooks/use-toast';

export function useCompanies() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: companies = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Company[];
    }
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (companyData: CreateCompanyData) => {
      const { data, error } = await supabase
        .from('companies')
        .insert(companyData)
        .select()
        .single();

      if (error) throw error;
      return data as Company;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({
        title: "Success",
        description: "Company created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create company",
        variant: "destructive",
      });
    }
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: UpdateCompanyData) => {
      const { data, error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Company;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({
        title: "Success", 
        description: "Company updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update company",
        variant: "destructive",
      });
    }
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({
        title: "Success",
        description: "Company deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete company",
        variant: "destructive",
      });
    }
  });

  return {
    companies,
    isLoading,
    error,
    createCompany: createCompanyMutation.mutateAsync,
    updateCompany: updateCompanyMutation.mutateAsync,
    deleteCompany: deleteCompanyMutation.mutateAsync,
    isCreating: createCompanyMutation.isPending,
    isUpdating: updateCompanyMutation.isPending,
    isDeleting: deleteCompanyMutation.isPending,
  };
}