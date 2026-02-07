import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WarehouseAssetReportFilters {
  locationId?: string;
  sublocationId?: string;
  departmentId?: string;
  categoryId?: string;
  subcategoryId?: string;
  status?: string;
  condition?: string;
  startDate?: string;
  endDate?: string;
  groupBy: 'location' | 'sublocation' | 'department';
}

export interface WarehouseAssetReportItem {
  asset_id: string;
  asset_tag: string | null;
  asset_name: string;
  brand: string | null;
  category_name: string | null;
  subcategory_name: string | null;
  serial_number: string | null;
  location_name: string;
  sublocation_name: string | null;
  department_name: string | null;
  status: string;
  condition: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  current_value: number | null;
}

export const useWarehouseAssetReport = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async (filters: WarehouseAssetReportFilters): Promise<WarehouseAssetReportItem[]> => {
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
          location_id,
          sublocation_id,
          department_id,
          category_id,
          subcategory_id,
          location:warehouse_locations!warehouse_assets_location_id_fkey(id, name),
          sublocation:warehouse_locations!warehouse_assets_sublocation_id_fkey(id, name),
          department:warehouse_locations!warehouse_assets_department_id_fkey(id, name),
          category:asset_categories!warehouse_assets_category_id_fkey(id, name),
          subcategory:asset_categories!warehouse_assets_subcategory_id_fkey(id, name)
        `);

      // Apply ordering based on groupBy
      if (filters.groupBy === 'location') {
        query = query
          .order('location_id', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true });
      } else if (filters.groupBy === 'sublocation') {
        query = query
          .order('location_id', { ascending: true, nullsFirst: false })
          .order('sublocation_id', { ascending: true, nullsFirst: true })
          .order('name', { ascending: true });
      } else {
        query = query
          .order('location_id', { ascending: true, nullsFirst: false })
          .order('sublocation_id', { ascending: true, nullsFirst: true })
          .order('department_id', { ascending: true, nullsFirst: true })
          .order('name', { ascending: true });
      }

      // Apply location filter
      if (filters.locationId) {
        query = query.eq('location_id', filters.locationId);
      }

      // Apply sublocation filter
      if (filters.sublocationId) {
        query = query.eq('sublocation_id', filters.sublocationId);
      }

      // Apply department filter
      if (filters.departmentId) {
        query = query.eq('department_id', filters.departmentId);
      }

      // Apply category filter
      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }

      // Apply subcategory filter
      if (filters.subcategoryId) {
        query = query.eq('subcategory_id', filters.subcategoryId);
      }

      // Apply status filter
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Apply condition filter
      if (filters.condition && filters.condition !== 'all') {
        query = query.eq('condition', filters.condition);
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
      const reportItems: WarehouseAssetReportItem[] = assets.map(asset => ({
        asset_id: asset.id,
        asset_tag: asset.asset_tag,
        asset_name: asset.name,
        brand: asset.brand,
        category_name: asset.category?.name || null,
        subcategory_name: asset.subcategory?.name || null,
        serial_number: asset.serial_number,
        location_name: asset.location?.name || 'Unassigned',
        sublocation_name: asset.sublocation?.name || null,
        department_name: asset.department?.name || null,
        status: asset.status || 'Unknown',
        condition: asset.condition,
        purchase_date: asset.purchase_date,
        purchase_price: asset.purchase_price,
        current_value: asset.current_value,
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
