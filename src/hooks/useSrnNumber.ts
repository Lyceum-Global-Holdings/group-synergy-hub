import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';



export const useGenerateSrnNumber = () => {
  return useMutation({
    mutationFn: async (companyId: string) => {
      if (!companyId) throw new Error('company_id required to generate SRN');
      const { data, error } = await supabase.rpc('generate_srn_number', {
        _company_id: companyId,
      });
      if (error) throw error;
      return data as string;
    },
  });
};

export const checkSrnExists = async (
  companyId: string,
  srnNumber: string,
  excludeId?: string
): Promise<boolean> => {
  if (!companyId || !srnNumber) return false;
  const { data, error } = await supabase.rpc('srn_number_exists', {
    _company_id: companyId,
    _srn_number: srnNumber,
    _exclude_id: excludeId ?? null,
  });
  if (error) throw error;
  return Boolean(data);
};
