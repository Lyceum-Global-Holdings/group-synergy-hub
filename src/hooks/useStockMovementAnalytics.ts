import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { format, subDays } from 'date-fns';

export interface DailyMovement {
  date: string;
  goods_receipt: number;
  material_issue: number;
  transfer: number;
  adjustment: number;
}

export function useStockMovementAnalytics(itemId?: string) {
  const { selectedCompany, isViewingAllCompanies } = useCompany();

  return useQuery({
    queryKey: ['stock-movement-analytics', selectedCompany?.id, isViewingAllCompanies, itemId],
    queryFn: async (): Promise<DailyMovement[]> => {
      const startDate = subDays(new Date(), 30);

      let query = supabase
        .from('stock_transactions')
        .select('created_at, transaction_type, quantity_change')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (!isViewingAllCompanies && selectedCompany?.id) {
        query = query.eq('company_id', selectedCompany.id);
      }

      if (itemId) {
        query = query.eq('item_id', itemId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by date
      const grouped: Record<string, DailyMovement> = {};

      // Pre-fill all 30 days
      for (let i = 30; i >= 0; i--) {
        const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
        grouped[d] = { date: d, goods_receipt: 0, material_issue: 0, transfer: 0, adjustment: 0 };
      }

      (data || []).forEach(row => {
        const day = format(new Date(row.created_at), 'yyyy-MM-dd');
        if (!grouped[day]) return;
        const qty = Math.abs(row.quantity_change);

        switch (row.transaction_type) {
          case 'goods_receipt':
            grouped[day].goods_receipt += qty;
            break;
          case 'material_issue':
          case 'project_issue':
            grouped[day].material_issue += qty;
            break;
          case 'transfer_in':
          case 'transfer_out':
            grouped[day].transfer += qty;
            break;
          case 'adjustment':
            grouped[day].adjustment += qty;
            break;
          case 'material_return':
          case 'project_return':
            grouped[day].goods_receipt += qty;
            break;
        }
      });

      return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}
