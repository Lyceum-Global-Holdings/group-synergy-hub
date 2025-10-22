import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { InventoryValuationMethod, ItemType, ValuationMethod } from '@/types/inventoryValuation';

interface CreateMethodData {
  item_type: ItemType;
  item_id?: string;
  valuation_method: ValuationMethod;
  is_default?: boolean;
  effective_from?: string;
}

export const useValuationMethods = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ['valuation-methods', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('inventory_valuation_methods')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as InventoryValuationMethod[];
    },
    enabled: !!selectedCompany?.id,
  });

  const createMethodMutation = useMutation({
    mutationFn: async (methodData: CreateMethodData) => {
      if (!selectedCompany?.id) throw new Error('No company selected');

      const { data, error } = await supabase
        .from('inventory_valuation_methods')
        .insert({
          ...methodData,
          company_id: selectedCompany.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valuation-methods'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-valuation'] });
      toast({
        title: 'Success',
        description: 'Valuation method saved successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save valuation method',
        variant: 'destructive',
      });
    },
  });

  const updateMethodMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreateMethodData> }) => {
      const { data, error } = await supabase
        .from('inventory_valuation_methods')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valuation-methods'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-valuation'] });
      toast({
        title: 'Success',
        description: 'Valuation method updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update valuation method',
        variant: 'destructive',
      });
    },
  });

  return {
    methods,
    isLoading,
    createMethod: createMethodMutation.mutate,
    updateMethod: updateMethodMutation.mutate,
    isCreating: createMethodMutation.isPending,
    isUpdating: updateMethodMutation.isPending,
  };
};
