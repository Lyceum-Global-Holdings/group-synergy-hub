import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useBankTransactions(bankAccountId?: string) {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['bank-transactions', bankAccountId],
    queryFn: async () => {
      if (!bankAccountId) return [];
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('bank_account_id', bankAccountId)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!bankAccountId,
  });

  return { transactions, isLoading };
}
