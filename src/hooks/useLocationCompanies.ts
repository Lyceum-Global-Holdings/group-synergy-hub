import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type LocationAssignmentMode = 'explicit' | 'inherit_parent';

export interface LocationCompanyAssignments {
  assignmentMode: LocationAssignmentMode;
  directCompanyIds: string[];
  effectiveCompanyIds: string[];
  inheritanceSourceId: string | null;
  inheritanceSourceName: string | null;
}

const EMPTY: LocationCompanyAssignments = {
  assignmentMode: 'explicit',
  directCompanyIds: [],
  effectiveCompanyIds: [],
  inheritanceSourceId: null,
  inheritanceSourceName: null,
};

export function useLocationCompanies(locationId?: string | null) {
  const queryClient = useQueryClient();

  const { data: assignments = EMPTY, isLoading } = useQuery({
    queryKey: ['location-company-assignments', locationId],
    queryFn: async (): Promise<LocationCompanyAssignments> => {
      if (!locationId) return EMPTY;
      const { data, error } = await supabase.rpc(
        'get_location_company_assignments_admin' as any,
        { p_location_id: locationId }
      );
      if (error) throw error;
      const row = (data as any[])?.[0];
      if (!row) return EMPTY;
      return {
        assignmentMode: (row.assignment_mode as LocationAssignmentMode) || 'explicit',
        directCompanyIds: (row.direct_company_ids as string[]) || [],
        effectiveCompanyIds: (row.effective_company_ids as string[]) || [],
        inheritanceSourceId: row.inheritance_source_id || null,
        inheritanceSourceName: row.inheritance_source_name || null,
      };
    },
    enabled: !!locationId,
  });

  const saveCompanies = useMutation({
    mutationFn: async ({
      locationId,
      companyIds,
      assignmentMode = 'explicit',
    }: {
      locationId: string;
      companyIds: string[];
      assignmentMode?: LocationAssignmentMode;
    }) => {
      const { error } = await supabase.rpc(
        'set_location_company_assignments_admin' as any,
        {
          p_location_id: locationId,
          p_company_ids: companyIds,
          p_assignment_mode: assignmentMode,
        }
      );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['location-company-assignments', vars.locationId] });
      queryClient.invalidateQueries({ queryKey: ['all-location-companies-admin'] });
      queryClient.invalidateQueries({ queryKey: ['all-effective-location-companies-admin'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-locations'] });
      queryClient.invalidateQueries({ queryKey: ['effective-locations-for-company'] });
      queryClient.invalidateQueries({ queryKey: ['effective-locations-for-companies'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-locations'] });
      queryClient.invalidateQueries({ queryKey: ['locations-for-companies'] });
    },
  });

  // Backwards-compatible aliases
  return {
    companyIds: assignments.directCompanyIds,
    assignments,
    isLoading,
    saveCompanies: saveCompanies.mutateAsync,
  };
}
