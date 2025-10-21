import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import type { GLSettings, UpdateGLSettingsData } from '@/types/generalLedger';

export function useGLSettings() {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const { data: glSettings, isLoading } = useQuery({
    queryKey: ['gl-settings', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      
      const { data, error } = await supabase
        .from('gl_settings')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .single();

      if (error) throw error;
      return data as GLSettings;
    },
    enabled: !!selectedCompany?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: UpdateGLSettingsData) => {
      if (!selectedCompany?.id) throw new Error('No company selected');

      const { data, error } = await supabase
        .from('gl_settings')
        .update(updates)
        .eq('company_id', selectedCompany.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gl-settings', selectedCompany?.id] });
      toast.success('GL settings updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update GL settings: ' + error.message);
    },
  });

  return {
    glSettings,
    isLoading,
    updateGLSettings: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    baseCurrency: glSettings?.base_currency || 'LKR',
    currencySymbol: glSettings?.currency_symbol || 'Rs.',
    decimalPlaces: glSettings?.decimal_places || 2,
  };
}
