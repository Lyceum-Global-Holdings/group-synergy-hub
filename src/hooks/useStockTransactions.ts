import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StockTransaction, CreateStockTransactionData } from '@/types/stockTransaction';
import { useToast } from '@/hooks/use-toast';

export const useStockTransactions = (itemId?: string, locationId?: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: transactions = [],
    isLoading,
    error
  } = useQuery({
    // Scope per (item, location) — same item_code at different locations is a
    // distinct SKU-at-Location and must NOT share a movement feed.
    queryKey: ['stock-transactions', itemId, locationId ?? null],
    queryFn: async () => {
      let query = supabase
        .from('stock_transactions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (itemId) {
        query = query.eq('item_id', itemId);
      }
      if (locationId) {
        query = query.eq('location_id', locationId);
      } else if (locationId === null) {
        // Explicit "no location" scope (legacy unassigned rows)
        query = query.is('location_id', null);
      }

      const { data: transactionsData, error } = await query;
      if (error) throw error;

      // Fetch profiles for all unique created_by user IDs
      const userIds = [...new Set(transactionsData?.map(t => t.created_by).filter(Boolean))] as string[];
      
      let profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles_directory')
          .select('user_id, full_name, email')
          .in('user_id', userIds);
        
        if (profilesData) {
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.user_id] = { full_name: profile.full_name, email: profile.email };
            return acc;
          }, {} as Record<string, { full_name: string | null; email: string | null }>);
        }
      }

      // Merge profiles with transactions
      const transactionsWithProfiles = transactionsData?.map(transaction => ({
        ...transaction,
        profiles: transaction.created_by ? profilesMap[transaction.created_by] || null : null
      })) || [];

      return transactionsWithProfiles as StockTransaction[];
    }
  });

  const createTransactionMutation = useMutation({
    mutationFn: async (transactionData: CreateStockTransactionData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('stock_transactions')
        .insert({
          ...transactionData,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast({
        title: "Success",
        description: "Stock transaction recorded successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating stock transaction:', error);
      toast({
        title: "Error",
        description: "Failed to record stock transaction",
        variant: "destructive",
      });
    }
  });

  return {
    transactions,
    isLoading,
    error,
    createTransaction: createTransactionMutation.mutate,
    isCreating: createTransactionMutation.isPending,
  };
};