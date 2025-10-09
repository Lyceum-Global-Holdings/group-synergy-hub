import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subMonths, format } from 'date-fns';

export interface AdjustmentAnalytics {
  totalAdjustments: number;
  totalValueImpact: number;
  pendingApprovals: number;
  highRiskItems: number;
  adjustmentsThisMonth: number;
  trendData: Array<{
    month: string;
    increases: number;
    decreases: number;
    total: number;
  }>;
  reasonBreakdown: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  topAdjustedItems: Array<{
    id: string;
    name: string;
    item_code: string;
    adjustmentCount: number;
    valueImpact: number;
  }>;
}

export const useAdjustmentAnalytics = () => {
  const {
    data: analytics,
    isLoading,
  } = useQuery({
    queryKey: ['adjustment-analytics'],
    queryFn: async () => {
      const sixMonthsAgo = subMonths(new Date(), 6);
      const oneMonthAgo = subMonths(new Date(), 1);

      // Get all adjustments
      const { data: allAdjustments, error: allError } = await supabase
        .from('stock_transactions')
        .select('*')
        .eq('transaction_type', 'adjustment');

      if (allError) throw allError;

      // Get adjustments this month
      const { data: thisMonthAdjustments, error: monthError } = await supabase
        .from('stock_transactions')
        .select('*')
        .eq('transaction_type', 'adjustment')
        .gte('created_at', oneMonthAgo.toISOString());

      if (monthError) throw monthError;

      // Get pending batches
      const { data: pendingBatches, error: pendingError } = await supabase
        .from('stock_adjustment_batches')
        .select('id')
        .eq('status', 'pending_approval');

      if (pendingError) throw pendingError;

      // Get item summary for high-risk items
      const { data: itemSummary, error: summaryError } = await supabase
        .from('v_adjustment_summary_by_item')
        .select('*')
        .gte('total_adjustments', 5);

      if (summaryError) throw summaryError;

      // Calculate total value impact
      const totalValueImpact = (allAdjustments || []).reduce(
        (sum, adj) => sum + (adj.total_value || 0),
        0
      );

      // Calculate trend data (last 6 months)
      const trendData = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

        const monthAdjustments = (allAdjustments || []).filter(adj => {
          const adjDate = new Date(adj.created_at);
          return adjDate >= monthStart && adjDate <= monthEnd;
        });

        const increases = monthAdjustments.filter(adj => adj.quantity_change > 0).length;
        const decreases = monthAdjustments.filter(adj => adj.quantity_change < 0).length;

        trendData.push({
          month: format(monthDate, 'MMM yyyy'),
          increases,
          decreases,
          total: monthAdjustments.length,
        });
      }

      // Calculate reason breakdown
      const reasonCounts: Record<string, number> = {};
      (allAdjustments || []).forEach(adj => {
        const reason = adj.adjustment_reason || 'Unspecified';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });

      const reasonBreakdown = Object.entries(reasonCounts).map(([reason, count]) => ({
        reason,
        count,
        percentage: ((count / (allAdjustments?.length || 1)) * 100),
      })).sort((a, b) => b.count - a.count);

      // Top adjusted items
      const topAdjustedItems = (itemSummary || [])
        .sort((a, b) => b.total_adjustments - a.total_adjustments)
        .slice(0, 10)
        .map(item => ({
          id: item.id,
          name: item.name,
          item_code: item.item_code,
          adjustmentCount: item.total_adjustments,
          valueImpact: (item.value_increases || 0) - (item.value_decreases || 0),
        }));

      return {
        totalAdjustments: allAdjustments?.length || 0,
        totalValueImpact,
        pendingApprovals: pendingBatches?.length || 0,
        highRiskItems: itemSummary?.length || 0,
        adjustmentsThisMonth: thisMonthAdjustments?.length || 0,
        trendData,
        reasonBreakdown,
        topAdjustedItems,
      } as AdjustmentAnalytics;
    },
  });

  return {
    analytics,
    isLoading,
  };
};
