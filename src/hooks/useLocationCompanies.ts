import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useLocationCompanies(locationId?: string | null) {
  const queryClient = useQueryClient();

  const { data: companyIds = [], isLoading } = useQuery({
    queryKey: ['location-companies', locationId],
    queryFn: async () => {
      if (!locationId) return [];
      const { data, error } = await supabase
        .from('warehouse_location_companies')
        .select('company_id')
        .eq('location_id', locationId);
      if (error) throw error;
      return data.map(d => d.company_id);
    },
    enabled: !!locationId,
  });

  const saveCompanies = useMutation({
    mutationFn: async ({ locationId, companyIds }: { locationId: string; companyIds: string[] }) => {
      const { error: deleteError } = await supabase
        .from('warehouse_location_companies')
        .delete()
        .eq('location_id', locationId);

      if (deleteError) throw deleteError;

      if (companyIds.length > 0) {
        const { error: insertError } = await supabase
          .from('warehouse_location_companies')
          .insert(companyIds.map(cid => ({ location_id: locationId, company_id: cid })));

        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['location-companies', vars.locationId] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-locations'] });
      queryClient.invalidateQueries({ queryKey: ['header-locations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-locations'] });
    },
  });

  return { companyIds, isLoading, saveCompanies: saveCompanies.mutateAsync };
}
