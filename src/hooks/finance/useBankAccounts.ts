import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

export function useBankAccounts() {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const { data: bankAccounts, isLoading } = useQuery({
    queryKey: ['bank-accounts', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('account_name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (account: any) => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .insert({ ...account, company_id: selectedCompany?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Bank account created');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { bankAccounts, isLoading, createBankAccount: createMutation.mutate };
}
