import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StockTransaction, CreateStockTransactionData } from '@/types/stockTransaction';
import { useToast } from '@/hooks/use-toast';

export const useStockTransactions = (itemId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: transactions = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['stock-transactions', itemId],
    queryFn: async () => {
      let query = supabase
        .from('stock_transactions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (itemId) {
        query = query.eq('item_id', itemId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as StockTransaction[];
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