import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';

export interface PaymentTerm {
  id: string;
  name: string;
  description: string | null;
  credit_days: number;
  discount_days: number | null;
  discount_percent: number | null;
  is_default: boolean | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentTermInput {
  name: string;
  description?: string;
  credit_days: number;
  discount_days?: number;
  discount_percent?: number;
  is_default?: boolean;
}

export function usePaymentTerms() {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const { data: paymentTerms, isLoading } = useQuery({
    queryKey: ['payment-terms', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('payment_terms')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('name');
      if (error) throw error;
      return data as PaymentTerm[];
    },
    enabled: !!selectedCompany?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreatePaymentTermInput) => {
      const { data, error } = await supabase
        .from('payment_terms')
        .insert({ ...input, company_id: selectedCompany?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-terms'] });
      toast.success('Payment term created');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PaymentTerm> & { id: string }) => {
      const { data, error } = await supabase
        .from('payment_terms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-terms'] });
      toast.success('Payment term updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('payment_terms')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-terms'] });
      toast.success('Payment term deleted');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    paymentTerms,
    isLoading,
    createPaymentTerm: createMutation.mutate,
    updatePaymentTerm: updateMutation.mutate,
    deletePaymentTerm: deleteMutation.mutate,
    isCreating: createMutation.isPending,
  };
}
