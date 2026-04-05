import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useNextWarehouseItemCode(categoryCode: string | null, companyId: string | null) {
  return useQuery({
    queryKey: ['next-warehouse-item-code', categoryCode, companyId],
    queryFn: async () => {
      if (!categoryCode) return null;

      const prefix = `INV-${categoryCode}-`;

      let query = supabase
        .from('warehouse_items')
        .select('item_code')
        .ilike('item_code', `${prefix}%`);

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching item codes:', error);
        return `${prefix}001`;
      }

      let maxSeq = 0;
      if (data && data.length > 0) {
        for (const row of data) {
          const seqStr = row.item_code.replace(prefix, '');
          const seq = parseInt(seqStr, 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }

      const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
      return `${prefix}${nextSeq}`;
    },
    enabled: !!categoryCode,
    staleTime: 0,
  });
}
