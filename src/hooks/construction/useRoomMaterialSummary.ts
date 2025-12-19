import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RoomMaterialSummary {
  roomId: string;
  roomName: string;
  floorName: string;
  issuedCount: number;
  returnedCount: number;
  issuedValue: number;
  returnedValue: number;
}

export interface ProjectMaterialSummary {
  totalIssued: number;
  totalReturned: number;
  totalIssuedValue: number;
  totalReturnedValue: number;
  roomSummaries: RoomMaterialSummary[];
}

export const useProjectMaterialSummary = (projectId: string | null, reportDate: string | null) => {
  return useQuery({
    queryKey: ['project-material-summary', projectId, reportDate],
    queryFn: async (): Promise<ProjectMaterialSummary> => {
      if (!projectId || !reportDate) {
        return {
          totalIssued: 0,
          totalReturned: 0,
          totalIssuedValue: 0,
          totalReturnedValue: 0,
          roomSummaries: [],
        };
      }

      // Get all floor drawings for this project
      const { data: floorDrawings, error: floorError } = await supabase
        .from('project_floor_drawings')
        .select('id, drawing_name')
        .eq('project_id', projectId);

      if (floorError) throw floorError;
      if (!floorDrawings || floorDrawings.length === 0) {
        return {
          totalIssued: 0,
          totalReturned: 0,
          totalIssuedValue: 0,
          totalReturnedValue: 0,
          roomSummaries: [],
        };
      }

      const floorIds = floorDrawings.map(f => f.id);
      const floorMap = new Map(floorDrawings.map(f => [f.id, f.drawing_name]));

      // Get all rooms for these floors
      const { data: rooms, error: roomsError } = await supabase
        .from('floor_drawing_rooms')
        .select('id, room_name, floor_drawing_id')
        .in('floor_drawing_id', floorIds);

      if (roomsError) throw roomsError;
      if (!rooms || rooms.length === 0) {
        return {
          totalIssued: 0,
          totalReturned: 0,
          totalIssuedValue: 0,
          totalReturnedValue: 0,
          roomSummaries: [],
        };
      }

      const roomIds = rooms.map(r => r.id);
      const roomMap = new Map(rooms.map(r => [r.id, { name: r.room_name, floorId: r.floor_drawing_id }]));

      // Get all transactions for these rooms on the report date
      const { data: transactions, error: transError } = await supabase
        .from('floor_room_material_transactions')
        .select('room_id, transaction_type, quantity, total_value, created_at')
        .in('room_id', roomIds)
        .gte('created_at', `${reportDate}T00:00:00`)
        .lt('created_at', `${reportDate}T23:59:59.999`);

      if (transError) throw transError;

      // Aggregate by room
      const roomAggregates = new Map<string, { issued: number; returned: number; issuedValue: number; returnedValue: number }>();

      (transactions || []).forEach(t => {
        const current = roomAggregates.get(t.room_id) || { issued: 0, returned: 0, issuedValue: 0, returnedValue: 0 };
        
        if (t.transaction_type === 'issue') {
          current.issued += t.quantity || 0;
          current.issuedValue += t.total_value || 0;
        } else if (t.transaction_type === 'return') {
          current.returned += t.quantity || 0;
          current.returnedValue += t.total_value || 0;
        }
        
        roomAggregates.set(t.room_id, current);
      });

      // Build room summaries
      const roomSummaries: RoomMaterialSummary[] = [];
      let totalIssued = 0;
      let totalReturned = 0;
      let totalIssuedValue = 0;
      let totalReturnedValue = 0;

      roomAggregates.forEach((agg, roomId) => {
        const roomInfo = roomMap.get(roomId);
        if (roomInfo) {
          roomSummaries.push({
            roomId,
            roomName: roomInfo.name,
            floorName: floorMap.get(roomInfo.floorId) || 'Unknown',
            issuedCount: agg.issued,
            returnedCount: agg.returned,
            issuedValue: agg.issuedValue,
            returnedValue: agg.returnedValue,
          });

          totalIssued += agg.issued;
          totalReturned += agg.returned;
          totalIssuedValue += agg.issuedValue;
          totalReturnedValue += agg.returnedValue;
        }
      });

      // Sort by floor name, then room name
      roomSummaries.sort((a, b) => {
        const floorCompare = a.floorName.localeCompare(b.floorName);
        if (floorCompare !== 0) return floorCompare;
        return a.roomName.localeCompare(b.roomName);
      });

      return {
        totalIssued,
        totalReturned,
        totalIssuedValue,
        totalReturnedValue,
        roomSummaries,
      };
    },
    enabled: !!projectId && !!reportDate,
  });
};
