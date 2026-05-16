import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Company, CreateCompanyData, UpdateCompanyData } from '@/types/company';
import { useToast } from '@/hooks/use-toast';
import { useSuperAdmin, useIsAdmin } from '@/hooks/useSuperAdmin';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';

export function useCompanies() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: isSuperAdmin, isLoading: isSuperAdminLoading } = useSuperAdmin();
  const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { data: userProfile, isLoading: isProfileLoading } = useCurrentUserProfile();

  // Wait until dependencies are loaded AND admin status is definitively known
  const dependenciesReady = !isSuperAdminLoading && !isAdminLoading && !isProfileLoading && 
    isSuperAdmin !== undefined && isAdmin !== undefined;

  const {
    data: companies = [],
    isLoading: isQueryLoading,
    error
  } = useQuery({
    queryKey: ['companies', isSuperAdmin, isAdmin, userProfile?.company_id, userProfile?.user_id],
    enabled: dependenciesReady,
    // Quasi-static lookup: companies change rarely; refresh every 2 min instead
    // of on every mount. Realtime invalidation still bumps this when needed.
    staleTime: 2 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      console.log('[useCompanies] Fetching - isSuperAdmin:', isSuperAdmin, 'isAdmin:', isAdmin, 'company_id:', userProfile?.company_id);

      let query = supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      // Super admins see ALL companies
      if (isSuperAdmin === true) {
        console.log('[useCompanies] Super admin - fetching ALL companies');
        // No filter applied
      } 
      // Regular admins see only their approved companies (primary + user_company_access)
      else if (isAdmin === true) {
        console.log('[useCompanies] Admin user - fetching approved companies');
        
        // Fetch user's additional company access
        const { data: accessData } = await supabase
          .from('user_company_access')
          .select('company_id')
          .eq('user_id', user.id);
        
        // Build list of accessible company IDs
        const accessibleCompanyIds = new Set<string>();
        
        // Add primary company
        if (userProfile?.company_id) {
          accessibleCompanyIds.add(userProfile.company_id);
        }
        
        // Add additional companies from user_company_access
        accessData?.forEach(access => {
          accessibleCompanyIds.add(access.company_id);
        });
        
        console.log('[useCompanies] Admin accessible companies:', Array.from(accessibleCompanyIds));
        
        if (accessibleCompanyIds.size > 0) {
          query = query.in('id', Array.from(accessibleCompanyIds));
        } else if (userProfile?.company_id) {
          // Fallback to primary company only
          query = query.eq('id', userProfile.company_id);
        }
      } 
      // Regular users see only their company
      else if (userProfile?.company_id) {
        console.log('[useCompanies] Regular user - filtering to company:', userProfile.company_id);
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

      // Fetch profiles for these users if there are any - use secure view
      let profileMap = new Map();
      if (userIds.size > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles_directory')
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