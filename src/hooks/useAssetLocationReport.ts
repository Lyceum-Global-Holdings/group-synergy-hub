import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

export interface AssetLocationReportFilters {
  locationId?: string;
  sublocationId?: string;
  categoryId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface AssetLocationReportItem {
  asset_id: string;
  asset_tag: string | null;
  asset_name: string;
  brand: string | null;
  category_name: string | null;
  subcategory_name: string | null;
  serial_number: string | null;
  location_name: string;
  sublocation_name: string | null;
  status: string;
  condition: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  current_value: number | null;
  accumulated_depreciation: number | null;
  depreciation_method: string | null;
  useful_life_years: number | null;
  notes: string | null;
}

export const useAssetLocationReport = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedCompany } = useCompany();

  const fetchReport = async (filters: AssetLocationReportFilters): Promise<AssetLocationReportItem[]> => {
    setIsLoading(true);
    setError(null);

    try {
      // Build query for warehouse_assets with joins
      let query = supabase
        .from('warehouse_assets')
        .select(`
          id,
          asset_tag,
          name,
          brand,
          serial_number,
          status,
          condition,
          purchase_date,
          purchase_price,
          current_value,
          accumulated_depreciation,
          depreciation_method,
          useful_life_years,
          notes,
          location_id,
          sublocation_id,
          category_id,
          subcategory_id,
          location:warehouse_locations!warehouse_assets_location_id_fkey(id, name),
          sublocation:warehouse_locations!warehouse_assets_sublocation_id_fkey(id, name),
          category:asset_categories!warehouse_assets_category_id_fkey(id, name),
          subcategory:asset_categories!warehouse_assets_subcategory_id_fkey(id, name)
        `)
        .order('location_id', { ascending: true, nullsFirst: false })
        .order('sublocation_id', { ascending: true, nullsFirst: true })
        .order('asset_name', { ascending: true });

      // Apply company filter if selected
      if (selectedCompany?.id) {
        query = query.eq('company_id', selectedCompany.id);
      }

      // Apply location filter
      if (filters.locationId) {
        query = query.eq('location_id', filters.locationId);
      }

      // Apply sublocation filter
      if (filters.sublocationId) {
        query = query.eq('sublocation_id', filters.sublocationId);
      }

      // Apply category filter
      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }

      // Apply status filter
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Apply date range filter on purchase_date
      if (filters.startDate) {
        query = query.gte('purchase_date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('purchase_date', filters.endDate);
      }

      const { data: assets, error: assetsError } = await query;
      
      if (assetsError) throw assetsError;
      if (!assets || assets.length === 0) return [];

      // Map assets to report items
      const reportItems: AssetLocationReportItem[] = assets.map(asset => ({
        asset_id: asset.id,
        asset_tag: asset.asset_tag,
        asset_name: asset.name,
        brand: asset.brand,
        category_name: asset.category?.name || null,
        subcategory_name: asset.subcategory?.name || null,
        serial_number: asset.serial_number,
        location_name: asset.location?.name || 'Unassigned',
        sublocation_name: asset.sublocation?.name || null,
        status: asset.status || 'Unknown',
        condition: asset.condition,
        purchase_date: asset.purchase_date,
        purchase_price: asset.purchase_price,
        current_value: asset.current_value,
        accumulated_depreciation: asset.accumulated_depreciation,
        depreciation_method: asset.depreciation_method,
        useful_life_years: asset.useful_life_years,
        notes: asset.notes,
      }));

      return reportItems;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch asset report data';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    fetchReport,
    isLoading,
    error
  };
};
