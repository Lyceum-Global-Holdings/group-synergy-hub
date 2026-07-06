import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCachedUser } from "@/lib/currentUser";
import { CreateStockTransactionData } from '@/types/stockTransaction';
import { useToast } from '@/hooks/use-toast';

/**
 * SKU-at-Bin movement history.
 *
 * Reader uses `get_bin_scoped_stock_movements` RPC so quantity_before /
 * quantity_after are always recomputed per (item, bin) — never the legacy
 * item-total values. When `locationId` is provided, only transactions whose
 * bin physically belongs to that location are returned.
 */
export const useStockTransactions = (
  itemId?: string,
  locationId?: string | null,
  binId?: string | null,
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: transactions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['stock-transactions', itemId, locationId ?? null, binId ?? 'any'],
    enabled: !!itemId,
    queryFn: async () => {
      if (!itemId) return [];

      const { data, error: rpcError } = await supabase.rpc(
        'get_bin_scoped_stock_movements',
        {
          p_item_id: itemId,
          p_location_id: locationId ?? null,
          p_bin_id: binId ?? null,
        },
      );
      if (rpcError) throw rpcError;

      const rows = (data || []) as any[];

      // Hydrate creator profile for display.
      const userIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
      let profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles_directory')
          .select('user_id, full_name, email')
          .in('user_id', userIds);
        if (profilesData) {
          profilesMap = profilesData.reduce((acc, p) => {
            acc[p.user_id] = { full_name: p.full_name, email: p.email };
            return acc;
          }, {} as Record<string, { full_name: string | null; email: string | null }>);
        }
      }

      return rows.map((r) => ({
        ...r,
        item_id: itemId,
        profiles: r.created_by ? profilesMap[r.created_by] || null : null,
      }));
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: async (transactionData: CreateStockTransactionData) => {
      const user = getCachedUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error: insErr } = await supabase
        .from('stock_transactions')
        .insert({
          ...transactionData,
          created_by: user.id,
        })
        .select()
        .single();

      if (insErr) throw insErr;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast({ title: 'Success', description: 'Stock transaction recorded successfully' });
    },
    onError: (err) => {
      console.error('Error creating stock transaction:', err);
      toast({
        title: 'Error',
        description: 'Failed to record stock transaction',
        variant: 'destructive',
      });
    },
  });

  return {
    transactions,
    isLoading,
    error,
    createTransaction: createTransactionMutation.mutate,
    isCreating: createTransactionMutation.isPending,
  };
};
