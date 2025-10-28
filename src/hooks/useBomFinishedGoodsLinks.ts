import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BomFinishedGoodLink {
  id: string;
  bom_id: string;
  finished_good_id: string;
  created_at: string;
  created_by?: string;
}

// Hook to fetch linked products counts for all BOMs
export function useBomLinkedProductsCounts() {
  return useQuery({
    queryKey: ['bom-linked-products-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bom_finished_goods')
        .select('bom_id, finished_good_id');
      
      if (error) throw error;
      
      // Count products per BOM
      const counts: Record<string, number> = {};
      data.forEach(link => {
        counts[link.bom_id] = (counts[link.bom_id] || 0) + 1;
      });
      
      return counts;
    }
  });
}

export function useBomFinishedGoodsLinks(bomId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: linkedProducts = [], isLoading } = useQuery({
    queryKey: ['bom-finished-goods-links', bomId],
    queryFn: async () => {
      if (!bomId) return [];
      
      const { data, error } = await supabase
        .from('bom_finished_goods')
        .select(`
          *,
          finished_goods:finished_good_id (
            id,
            product_code,
            product_name,
            size,
            color,
            product_master_id
          )
        `)
        .eq('bom_id', bomId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!bomId
  });

  const bulkLinkFinishedGoods = useMutation({
    mutationFn: async ({ bomId, finishedGoodIds }: { bomId: string; finishedGoodIds: string[] }) => {
      const user = await supabase.auth.getUser();
      
      // Create link records for each finished good
      const linkRecords = finishedGoodIds.map(fgId => ({
        bom_id: bomId,
        finished_good_id: fgId,
        created_by: user.data.user?.id
      }));

      const { data, error } = await supabase
        .from('bom_finished_goods')
        .insert(linkRecords)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bom-finished-goods-links'] });
      queryClient.invalidateQueries({ queryKey: ['bom-linked-products-counts'] });
      queryClient.invalidateQueries({ queryKey: ['bill-of-materials'] });
      toast({
        title: "Success",
        description: `${data.length} product(s) linked successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to link products",
        variant: "destructive",
      });
    }
  });

  const unlinkFinishedGood = useMutation({
    mutationFn: async ({ bomId, finishedGoodId }: { bomId: string; finishedGoodId: string }) => {
      const { error } = await supabase
        .from('bom_finished_goods')
        .delete()
        .eq('bom_id', bomId)
        .eq('finished_good_id', finishedGoodId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-finished-goods-links'] });
      queryClient.invalidateQueries({ queryKey: ['bom-linked-products-counts'] });
      queryClient.invalidateQueries({ queryKey: ['bill-of-materials'] });
      toast({
        title: "Success",
        description: "Product unlinked successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unlink product",
        variant: "destructive",
      });
    }
  });

  return {
    linkedProducts,
    isLoading,
    bulkLinkFinishedGoods: bulkLinkFinishedGoods.mutateAsync,
    unlinkFinishedGood: unlinkFinishedGood.mutateAsync,
    isLinking: bulkLinkFinishedGoods.isPending,
    isUnlinking: unlinkFinishedGood.isPending,
  };
}
