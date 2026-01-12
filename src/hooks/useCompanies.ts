import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Company, CreateCompanyData, UpdateCompanyData } from '@/types/company';
import { useToast } from '@/hooks/use-toast';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';

export function useCompanies() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: isSuperAdmin, isLoading: isSuperAdminLoading } = useSuperAdmin();
  const { data: userProfile, isLoading: isProfileLoading } = useCurrentUserProfile();

  // Wait until dependencies are loaded AND super admin status is definitively known
  const dependenciesReady = !isSuperAdminLoading && !isProfileLoading && isSuperAdmin !== undefined;

  const {
    data: companies = [],
    isLoading: isQueryLoading,
    error
  } = useQuery({
    queryKey: ['companies', isSuperAdmin, userProfile?.company_id],
    enabled: dependenciesReady,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      // Super admins see ALL companies (no filter applied)
      // Non-super admins with a company_id see only their company
      const shouldFilterByCompany = isSuperAdmin !== true && userProfile?.company_id;
      
      if (shouldFilterByCompany) {
        query = query.eq('id', userProfile.company_id);
      }

      const { data: companiesData, error } = await query;

      if (error) throw error;
      if (!companiesData || companiesData.length === 0) return [];

      // Get all unique user IDs for HOD and Manager
      const userIds = new Set<string>();
      companiesData.forEach(company => {
        if (company.hod_user_id) userIds.add(company.hod_user_id);
        if (company.manager_user_id) userIds.add(company.manager_user_id);
      });

      // Fetch profiles for these users if there are any
      let profileMap = new Map();
      if (userIds.size > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', Array.from(userIds));

        if (profilesError) throw profilesError;

        profileMap = new Map(
          (profiles || []).map(p => [p.user_id, p])
        );
      }

      // Merge profile data into companies
      return companiesData.map(company => ({
        ...company,
        hod: company.hod_user_id ? profileMap.get(company.hod_user_id) : null,
        manager: company.manager_user_id ? profileMap.get(company.manager_user_id) : null,
      })) as Company[];
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (companyData: CreateCompanyData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('companies')
        .insert({
          ...companyData,
          created_by: user?.id,
        })
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
    // Fixed: Ensure loading is true when dependencies aren't ready OR when query is running
    isLoading: !dependenciesReady || isQueryLoading,
    error,
    createCompany: createCompanyMutation.mutateAsync,
    updateCompany: updateCompanyMutation.mutateAsync,
    deleteCompany: deleteCompanyMutation.mutateAsync,
    isCreating: createCompanyMutation.isPending,
    isUpdating: updateCompanyMutation.isPending,
    isDeleting: deleteCompanyMutation.isPending,
  };
}