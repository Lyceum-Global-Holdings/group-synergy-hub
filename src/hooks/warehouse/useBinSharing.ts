import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Toggle a bin's multi-owner (shared) flag.
 *
 * Shared bins follow the SAP EWM "Party Entitled to Dispose" model:
 * one physical bin can hold stock owned by multiple companies, while
 * remaining pinned to a single physical location.
 */
export function useSetBinSharing() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { binId: string; isShared: boolean }) => {
      const { data, error } = await supabase.rpc('set_bin_sharing', {
        _bin_id: params.binId,
        _is_shared: params.isShared,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['warehouse-bins'] });
      qc.invalidateQueries({ queryKey: ['bin-allocations'] });
      toast({
        title: vars.isShared ? 'Bin marked as shared' : 'Bin marked as single-owner',
        description: vars.isShared
          ? 'Multiple companies can now hold stock in this bin.'
          : 'Only the bin operator company can hold stock in this bin.',
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Could not update bin sharing',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
}
