import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';
import { flattenCatalog } from '@/lib/flattenWarehouseItem';

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface AnalyticsFilters {
  projectId?: string;
  periodType: PeriodType;
  startDate: Date;
  endDate: Date;
}

export interface FloorSummary {
  floorId: string;
  floorName: string;
  issued: number;
  returned: number;
  net: number;
  issuedValue: number;
  returnedValue: number;
}

export interface ItemSummary {
  itemId: string;
  itemName: string;
  itemCode: string;
  issued: number;
  returned: number;
  net: number;
  issuedValue: number;
  returnedValue: number;
}

export interface TrendDataPoint {
  date: string;
  issued: number;
  returned: number;
  issuedValue: number;
  returnedValue: number;
}

export interface AnalyticsData {
  summary: {
    totalIssued: number;
    totalReturned: number;
    netUsage: number;
    totalIssuedValue: number;
    totalReturnedValue: number;
    netValue: number;
    uniqueItems: number;
    uniqueFloors: number;
  };
  byFloor: FloorSummary[];
  byItem: ItemSummary[];
  trend: TrendDataPoint[];
}

export function getDateRange(periodType: PeriodType, referenceDate: Date): { start: Date; end: Date } {
  switch (periodType) {
    case 'daily':
      return { start: startOfDay(referenceDate), end: endOfDay(referenceDate) };
    case 'weekly':
      return { start: startOfWeek(referenceDate, { weekStartsOn: 1 }), end: endOfWeek(referenceDate, { weekStartsOn: 1 }) };
    case 'monthly':
      return { start: startOfMonth(referenceDate), end: endOfMonth(referenceDate) };
    default:
      return { start: startOfDay(referenceDate), end: endOfDay(referenceDate) };
  }
}

export const useSiteReportAnalytics = (filters: AnalyticsFilters) => {
  return useQuery({
    queryKey: ['site-report-analytics', filters.projectId, filters.periodType, filters.startDate.toISOString(), filters.endDate.toISOString()],
    queryFn: async (): Promise<AnalyticsData> => {
      const startDateStr = format(filters.startDate, 'yyyy-MM-dd');
      const endDateStr = format(filters.endDate, 'yyyy-MM-dd');

      // Build query for transactions
      let query = supabase
        .from('floor_room_material_transactions')
        .select(`
          id,
          room_id,
          warehouse_item_id,
          transaction_type,
          quantity,
          total_value,
          created_at,
          floor_drawing_rooms!inner (
            id,
            room_name,
            floor_drawing_id,
            project_floor_drawings!inner (
              id,
              drawing_name,
              project_id
            )
          ),
          warehouse_items(
            id,
            catalog:warehouse_item_catalog!warehouse_items_catalog_item_id_fkey(name, item_code)
          )
        `)
        .gte('created_at', `${startDateStr}T00:00:00`)
        .lte('created_at', `${endDateStr}T23:59:59.999`);

      if (filters.projectId) {
        query = query.eq('floor_drawing_rooms.project_floor_drawings.project_id', filters.projectId);
      }

      const { data: transactions, error } = await query;

      if (error) throw error;

      // Initialize aggregation structures
      const floorMap = new Map<string, FloorSummary>();
      const itemMap = new Map<string, ItemSummary>();
      const trendMap = new Map<string, TrendDataPoint>();

      // Initialize trend data for all days in range
      const allDays = eachDayOfInterval({ start: filters.startDate, end: filters.endDate });
      allDays.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        trendMap.set(dateKey, {
          date: dateKey,
          issued: 0,
          returned: 0,
          issuedValue: 0,
          returnedValue: 0,
        });
      });

      let totalIssued = 0;
      let totalReturned = 0;
      let totalIssuedValue = 0;
      let totalReturnedValue = 0;
      const uniqueItems = new Set<string>();
      const uniqueFloors = new Set<string>();

      (transactions || []).forEach((t: any) => {
        const qty = t.quantity || 0;
        const value = t.total_value || 0;
        const isIssue = t.transaction_type === 'issue';
        
        // Floor aggregation
        const floorData = t.floor_drawing_rooms?.project_floor_drawings;
        if (floorData) {
          const floorId = floorData.id;
          const floorName = floorData.drawing_name || 'Unknown Floor';
          uniqueFloors.add(floorId);

          const existing = floorMap.get(floorId) || {
            floorId,
            floorName,
            issued: 0,
            returned: 0,
            net: 0,
            issuedValue: 0,
            returnedValue: 0,
          };

          if (isIssue) {
            existing.issued += qty;
            existing.issuedValue += value;
          } else {
            existing.returned += qty;
            existing.returnedValue += value;
          }
          existing.net = existing.issued - existing.returned;
          floorMap.set(floorId, existing);
        }

        // Item aggregation
        const itemData = t.warehouse_items;
        if (itemData) {
          const itemId = itemData.id;
          uniqueItems.add(itemId);

          const existing = itemMap.get(itemId) || {
            itemId,
            itemName: itemData.name || 'Unknown Item',
            itemCode: itemData.item_code || '',
            issued: 0,
            returned: 0,
            net: 0,
            issuedValue: 0,
            returnedValue: 0,
          };

          if (isIssue) {
            existing.issued += qty;
            existing.issuedValue += value;
          } else {
            existing.returned += qty;
            existing.returnedValue += value;
          }
          existing.net = existing.issued - existing.returned;
          itemMap.set(itemId, existing);
        }

        // Trend aggregation
        const dateKey = format(new Date(t.created_at), 'yyyy-MM-dd');
        const trendPoint = trendMap.get(dateKey);
        if (trendPoint) {
          if (isIssue) {
            trendPoint.issued += qty;
            trendPoint.issuedValue += value;
          } else {
            trendPoint.returned += qty;
            trendPoint.returnedValue += value;
          }
        }

        // Totals
        if (isIssue) {
          totalIssued += qty;
          totalIssuedValue += value;
        } else {
          totalReturned += qty;
          totalReturnedValue += value;
        }
      });

      // Sort and convert to arrays
      const byFloor = Array.from(floorMap.values()).sort((a, b) => b.net - a.net);
      const byItem = Array.from(itemMap.values()).sort((a, b) => b.net - a.net);
      const trend = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      return {
        summary: {
          totalIssued,
          totalReturned,
          netUsage: totalIssued - totalReturned,
          totalIssuedValue,
          totalReturnedValue,
          netValue: totalIssuedValue - totalReturnedValue,
          uniqueItems: uniqueItems.size,
          uniqueFloors: uniqueFloors.size,
        },
        byFloor,
        byItem,
        trend,
      };
    },
    enabled: !!filters.startDate && !!filters.endDate,
  });
};
