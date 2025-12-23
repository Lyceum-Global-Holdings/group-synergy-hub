import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useRealtimeStockUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('stock-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'warehouse_bin_allocations'
        },
        (payload) => {
          console.log('Bin allocation changed:', payload);
          queryClient.invalidateQueries({ queryKey: ['warehouse-bin-allocations'] });
          queryClient.invalidateQueries({ queryKey: ['all-items-location-stock'] });
          queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'warehouse_bins'
        },
        (payload) => {
          console.log('Bin updated:', payload);
          queryClient.invalidateQueries({ queryKey: ['warehouse-bins'] });
          queryClient.invalidateQueries({ queryKey: ['all-items-location-stock'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
