import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BulkBinScopeParams {
  binIds: string[];
  companyIds: string[];
  locationIds: string[];
  mode: 'clone' | 'replace';
  global: boolean;
}

export interface BulkBinScopeResult {
  created: number;
  deleted: number;
  skipped: Array<Record<string, unknown>>;
}

export function useBulkBinScope() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (p: BulkBinScopeParams): Promise<BulkBinScopeResult> => {
      const { data, error } = await supabase.rpc('bulk_clone_bin_scope', {
        _bin_ids: p.binIds,
        _company_ids: p.companyIds,
        _location_ids: p.locationIds,
        _mode: p.mode,
        _global: p.global,
      });
      if (error) throw error;
      return data as unknown as BulkBinScopeResult;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['warehouse-bins'] });
      qc.invalidateQueries({ queryKey: ['bin-allocations'] });
      const skipped = Array.isArray(res.skipped) ? res.skipped.length : 0;
      toast({
        title: 'Bulk scope updated',
        description: `${res.created} created${res.deleted ? `, ${res.deleted} removed` : ''}${skipped ? `, ${skipped} skipped` : ''}.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Bulk scope failed', description: err.message, variant: 'destructive' });
    },
  });
}
