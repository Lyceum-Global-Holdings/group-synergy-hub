import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { ItemValuation, ValuationFilters } from '@/types/inventoryValuation';

export const useInventoryValuation = (filters?: ValuationFilters) => {
  const { selectedCompany } = useCompany();

  const { data: valuationData = [], isLoading, error } = useQuery({
    queryKey: ['inventory-valuation', selectedCompany?.id, filters],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const { data, error } = await supabase.rpc('calculate_inventory_valuation', {
        p_company_id: selectedCompany.id,
        p_valuation_date: filters?.valuationDate || new Date().toISOString().split('T')[0],
        p_item_types: filters?.itemTypes || ['raw_material', 'finished_good', 'asset'],
        p_category_ids: filters?.categoryIds || null,
        p_location_ids: filters?.locationIds || null,
      });

      if (error) throw error;
      return (data || []) as ItemValuation[];
    },
    enabled: !!selectedCompany?.id,
  });

  // Calculate summary statistics
  const summary = {
    total_inventory_value: valuationData.reduce((sum, item) => sum + (item.total_value || 0), 0),
    raw_materials_value: valuationData
      .filter(item => item.item_type === 'raw_material')
      .reduce((sum, item) => sum + (item.total_value || 0), 0),
    finished_goods_value: valuationData
      .filter(item => item.item_type === 'finished_good')
      .reduce((sum, item) => sum + (item.total_value || 0), 0),
    assets_value: valuationData
      .filter(item => item.item_type === 'asset')
      .reduce((sum, item) => sum + (item.total_value || 0), 0),
    total_items: valuationData.length,
    dead_stock_value: valuationData
      .filter(item => item.aging_bucket === '365+ days')
      .reduce((sum, item) => sum + (item.total_value || 0), 0),
    slow_moving_value: valuationData
      .filter(item => item.aging_bucket === '181-365 days')
      .reduce((sum, item) => sum + (item.total_value || 0), 0),
    aging_breakdown: {
      '0-30 days': valuationData.filter(item => item.aging_bucket === '0-30 days').reduce((sum, item) => sum + item.total_value, 0),
      '31-90 days': valuationData.filter(item => item.aging_bucket === '31-90 days').reduce((sum, item) => sum + item.total_value, 0),
      '91-180 days': valuationData.filter(item => item.aging_bucket === '91-180 days').reduce((sum, item) => sum + item.total_value, 0),
      '181-365 days': valuationData.filter(item => item.aging_bucket === '181-365 days').reduce((sum, item) => sum + item.total_value, 0),
      '365+ days': valuationData.filter(item => item.aging_bucket === '365+ days').reduce((sum, item) => sum + item.total_value, 0),
    },
  };

  return {
    valuationData,
    summary,
    isLoading,
    error,
  };
};
