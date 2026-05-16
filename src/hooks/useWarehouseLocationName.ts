import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Lightweight selector for a single warehouse location's display name.
 * Avoids loading the entire location hierarchy when a page only needs
 * to label the currently-selected location.
 */
export function useWarehouseLocationName(locationId: string | null | undefined) {
  return useQuery({
    queryKey: ['warehouse-location-name', locationId],
    enabled: !!locationId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_locations')
        .select('id,name')
        .eq('id', locationId!)
        .maybeSingle();
      if (error) throw error;
      return data?.name ?? null;
    },
  });
}
