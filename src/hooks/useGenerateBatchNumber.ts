import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * GS1 Application Identifier (10) — Batch/Lot Number
 * Format: LOT-{ITEMCODE}-{YYDDD}-{NNNN}, max 20 chars, [A-Z0-9./-].
 */
export const BATCH_NUMBER_REGEX = /^[A-Z0-9./-]{1,20}$/;

export const useGenerateBatchNumber = () => {
  return useMutation({
    mutationFn: async (params: { companyId: string; warehouseItemId: string }) => {
      const { companyId, warehouseItemId } = params;
      if (!companyId || !warehouseItemId) {
        throw new Error('company_id and warehouse_item_id are required');
      }
      const { data, error } = await supabase.rpc('generate_batch_number' as any, {
        _company_id: companyId,
        _warehouse_item_id: warehouseItemId,
      });
      if (error) throw error;
      return data as string;
    },
  });
};
