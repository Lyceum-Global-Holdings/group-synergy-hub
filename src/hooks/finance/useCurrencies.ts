import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_base_currency: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate_date: string;
  exchange_rate: number;
  rate_type: string | null;
  company_id: string | null;
  created_at: string;
}

export interface CreateExchangeRateInput {
  from_currency: string;
  to_currency: string;
  rate_date: string;
  exchange_rate: number;
  rate_type?: string;
}

export function useCurrencies() {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const { data: currencies, isLoading: currenciesLoading } = useQuery({
    queryKey: ['currencies', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('currencies')
        .select('*')
        .order('code');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  const { data: exchangeRates, isLoading: ratesLoading } = useQuery({
    queryKey: ['exchange-rates', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('rate_date', { ascending: false });
      if (error) throw error;
      return data as ExchangeRate[];
    },
    enabled: !!selectedCompany?.id,
  });

  const createCurrencyMutation = useMutation({
    mutationFn: async (input: Omit<Currency, 'id' | 'created_at' | 'updated_at' | 'company_id'>) => {
      const { data, error } = await supabase
        .from('currencies')
        .insert({ ...input, company_id: selectedCompany?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currencies'] });
      toast.success('Currency created');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createExchangeRateMutation = useMutation({
    mutationFn: async (input: CreateExchangeRateInput) => {
      const { data, error } = await supabase
        .from('exchange_rates')
        .insert({ ...input, company_id: selectedCompany?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
      toast.success('Exchange rate added');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const runFxRevaluation = useMutation({
    mutationFn: async (asOfDate: string) => {
      const { data, error } = await supabase.rpc('run_fx_revaluation', {
        p_company_id: selectedCompany?.id,
        p_as_of_date: asOfDate,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('FX revaluation completed');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    currencies,
    exchangeRates,
    isLoading: currenciesLoading || ratesLoading,
    createCurrency: createCurrencyMutation.mutate,
    createExchangeRate: createExchangeRateMutation.mutate,
    runFxRevaluation: runFxRevaluation.mutate,
    isCreatingRate: createExchangeRateMutation.isPending,
  };
}
