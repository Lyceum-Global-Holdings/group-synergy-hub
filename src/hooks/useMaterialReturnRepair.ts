import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type RepairCandidateMrn = {
  id: string;
  mrn_number: string;
  return_date: string;
  returned_by: string | null;
  notes: string | null;
  status: string;
  item_count: number;
  total_value: number;
};

export type RepairOverride = {
  item_id: string;
  quantity_returned?: number;
  condition?: 'good' | 'damaged' | 'expired';
  notes?: string;
};

export const useRepairCandidateMrns = (targetMrnId: string | null, search: string) => {
  return useQuery({
    queryKey: ['mrn-repair-candidates', targetMrnId, search],
    enabled: !!targetMrnId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_repair_candidate_mrns' as any, {
        p_target_mrn_id: targetMrnId,
        p_search: search?.trim() || null,
        p_limit: 50,
      });
      if (error) throw error;
      return (data ?? []) as RepairCandidateMrn[];
    },
  });
};

export const useMaterialReturnRepair = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const repairMutation = useMutation({
    mutationFn: async ({
      targetMrnId,
      sourceMrnId,
      overrides,
    }: {
      targetMrnId: string;
      sourceMrnId: string;
      overrides?: RepairOverride[];
    }) => {
      const { data, error } = await supabase.rpc('repair_material_return_from_reference' as any, {
        p_target_mrn_id: targetMrnId,
        p_source_mrn_id: sourceMrnId,
        p_overrides: (overrides ?? []) as any,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count, vars) => {
      queryClient.invalidateQueries({ queryKey: ['material-returns'] });
      queryClient.invalidateQueries({ queryKey: ['material-return-items', vars.targetMrnId] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['item-bin-allocations'] });
      toast({
        title: 'Repair complete',
        description: `${count} item line${count === 1 ? '' : 's'} added from reference MRN.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Repair failed',
        description: error?.message ?? 'Could not repair the material return note.',
        variant: 'destructive',
      });
    },
  });

  return {
    repairAsync: repairMutation.mutateAsync,
    isRepairing: repairMutation.isPending,
  };
};
