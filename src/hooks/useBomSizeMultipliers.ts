import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BomSizeMultiplier, CreateSizeMultiplierData } from '@/types/bom';
import { useToast } from '@/hooks/use-toast';

export function useBomSizeMultipliers(bomId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: multipliers = [], isLoading } = useQuery({
    queryKey: ['bom-size-multipliers', bomId],
    queryFn: async () => {
      if (!bomId) return [];
      const { data, error } = await supabase
        .from('bom_size_multipliers')
        .select('*')
        .eq('bom_id', bomId)
        .order('size');
      
      if (error) throw error;
      return data as BomSizeMultiplier[];
    },
    enabled: !!bomId
  });

  const upsertMultipliers = useMutation({
    mutationFn: async (multipliersData: CreateSizeMultiplierData[]) => {
      const { data, error } = await supabase
        .from('bom_size_multipliers')
        .upsert(multipliersData, { onConflict: 'bom_id,size' })
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-size-multipliers'] });
      toast({ 
        title: "Success", 
        description: "Size multipliers updated successfully" 
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update size multipliers",
        variant: "destructive",
      });
    }
  });

  const deleteMultiplier = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bom_size_multipliers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-size-multipliers'] });
      toast({ 
        title: "Success", 
        description: "Size multiplier deleted successfully" 
      });
    }
  });

  const getMultiplierForSize = (size: string): number => {
    const multiplier = multipliers.find(m => m.size === size);
    return multiplier?.multiplier || 1.0;
  };

  return {
    multipliers,
    isLoading,
    upsertMultipliers: upsertMultipliers.mutateAsync,
    deleteMultiplier: deleteMultiplier.mutateAsync,
    getMultiplierForSize,
    isUpdating: upsertMultipliers.isPending,
  };
}
