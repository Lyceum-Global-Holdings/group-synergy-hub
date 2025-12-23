import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RoomSummary {
  roomId: string;
  roomName: string;
  issuedCount: number;
  returnedCount: number;
  issuedValue: number;
  returnedValue: number;
}

export interface FloorMaterialSummary {
  floorId: string;
  floorName: string;
  issuedCount: number;
  returnedCount: number;
  issuedValue: number;
  returnedValue: number;
  rooms: RoomSummary[];
}

export interface ProjectFloorMaterialSummary {
  totalIssued: number;
  totalReturned: number;
  totalIssuedValue: number;
  totalReturnedValue: number;
  floors: FloorMaterialSummary[];
}

export const useFloorMaterialSummary = (projectId: string | null, reportDate: string | null) => {
  return useQuery({
    queryKey: ['floor-material-summary', projectId, reportDate],
    queryFn: async (): Promise<ProjectFloorMaterialSummary> => {
      if (!projectId || !reportDate) {
        return {
          totalIssued: 0,
          totalReturned: 0,
          totalIssuedValue: 0,
          totalReturnedValue: 0,
          floors: [],
        };
      }

      // Get all floor drawings for this project
      const { data: floorDrawings, error: floorError } = await supabase
        .from('project_floor_drawings')
        .select('id, drawing_name, floor_number')
        .eq('project_id', projectId)
        .order('floor_number', { ascending: true });

      if (floorError) throw floorError;
      if (!floorDrawings || floorDrawings.length === 0) {
        return {
          totalIssued: 0,
          totalReturned: 0,
          totalIssuedValue: 0,
          totalReturnedValue: 0,
          floors: [],
        };
      }

      const floorIds = floorDrawings.map(f => f.id);

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
          floors: [],
        };
      }

      const roomIds = rooms.map(r => r.id);

      // Get all transactions for these rooms on the report date
      const { data: transactions, error: transError } = await supabase
        .from('floor_room_material_transactions')
        .select('room_id, transaction_type, quantity, total_value, created_at')
        .in('room_id', roomIds)
        .gte('created_at', `${reportDate}T00:00:00`)
        .lt('created_at', `${reportDate}T23:59:59.999`);

      if (transError) throw transError;

      // Build room to floor mapping
      const roomToFloor = new Map<string, string>();
      rooms.forEach(r => roomToFloor.set(r.id, r.floor_drawing_id));

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

      // Build floor summaries
      const floorSummaries: FloorMaterialSummary[] = [];
      let totalIssued = 0;
      let totalReturned = 0;
      let totalIssuedValue = 0;
      let totalReturnedValue = 0;

      floorDrawings.forEach(floor => {
        const floorRooms = rooms.filter(r => r.floor_drawing_id === floor.id);
        const roomSummaries: RoomSummary[] = [];
        let floorIssued = 0;
        let floorReturned = 0;
        let floorIssuedValue = 0;
        let floorReturnedValue = 0;

        floorRooms.forEach(room => {
          const agg = roomAggregates.get(room.id);
          if (agg) {
            roomSummaries.push({
              roomId: room.id,
              roomName: room.room_name,
              issuedCount: agg.issued,
              returnedCount: agg.returned,
              issuedValue: agg.issuedValue,
              returnedValue: agg.returnedValue,
            });

            floorIssued += agg.issued;
            floorReturned += agg.returned;
            floorIssuedValue += agg.issuedValue;
            floorReturnedValue += agg.returnedValue;
          }
        });

        // Only include floors that have activity
        if (roomSummaries.length > 0) {
          floorSummaries.push({
            floorId: floor.id,
            floorName: floor.drawing_name,
            issuedCount: floorIssued,
            returnedCount: floorReturned,
            issuedValue: floorIssuedValue,
            returnedValue: floorReturnedValue,
            rooms: roomSummaries.sort((a, b) => a.roomName.localeCompare(b.roomName)),
          });

          totalIssued += floorIssued;
          totalReturned += floorReturned;
          totalIssuedValue += floorIssuedValue;
          totalReturnedValue += floorReturnedValue;
        }
      });

      return {
        totalIssued,
        totalReturned,
        totalIssuedValue,
        totalReturnedValue,
        floors: floorSummaries,
      };
    },
    enabled: !!projectId && !!reportDate,
  });
};

// Hook to get floor material summary for multiple dates (or all time)
export const useFloorMaterialSummaryAllTime = (projectId: string | null) => {
  return useQuery({
    queryKey: ['floor-material-summary-all', projectId],
    queryFn: async (): Promise<ProjectFloorMaterialSummary> => {
      if (!projectId) {
        return {
          totalIssued: 0,
          totalReturned: 0,
          totalIssuedValue: 0,
          totalReturnedValue: 0,
          floors: [],
        };
      }

      // Get all floor drawings for this project
      const { data: floorDrawings, error: floorError } = await supabase
        .from('project_floor_drawings')
        .select('id, drawing_name, floor_number')
        .eq('project_id', projectId)
        .order('floor_number', { ascending: true });

      if (floorError) throw floorError;
      if (!floorDrawings || floorDrawings.length === 0) {
        return {
          totalIssued: 0,
          totalReturned: 0,
          totalIssuedValue: 0,
          totalReturnedValue: 0,
          floors: [],
        };
      }

      const floorIds = floorDrawings.map(f => f.id);

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
          floors: [],
        };
      }

      const roomIds = rooms.map(r => r.id);

      // Get ALL transactions for these rooms
      const { data: transactions, error: transError } = await supabase
        .from('floor_room_material_transactions')
        .select('room_id, transaction_type, quantity, total_value')
        .in('room_id', roomIds);

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

      // Build floor summaries
      const floorSummaries: FloorMaterialSummary[] = [];
      let totalIssued = 0;
      let totalReturned = 0;
      let totalIssuedValue = 0;
      let totalReturnedValue = 0;

      floorDrawings.forEach(floor => {
        const floorRooms = rooms.filter(r => r.floor_drawing_id === floor.id);
        const roomSummaries: RoomSummary[] = [];
        let floorIssued = 0;
        let floorReturned = 0;
        let floorIssuedValue = 0;
        let floorReturnedValue = 0;

        floorRooms.forEach(room => {
          const agg = roomAggregates.get(room.id);
          if (agg) {
            roomSummaries.push({
              roomId: room.id,
              roomName: room.room_name,
              issuedCount: agg.issued,
              returnedCount: agg.returned,
              issuedValue: agg.issuedValue,
              returnedValue: agg.returnedValue,
            });

            floorIssued += agg.issued;
            floorReturned += agg.returned;
            floorIssuedValue += agg.issuedValue;
            floorReturnedValue += agg.returnedValue;
          }
        });

        // Include all floors (even without activity) for completeness
        floorSummaries.push({
          floorId: floor.id,
          floorName: floor.drawing_name,
          issuedCount: floorIssued,
          returnedCount: floorReturned,
          issuedValue: floorIssuedValue,
          returnedValue: floorReturnedValue,
          rooms: roomSummaries.sort((a, b) => a.roomName.localeCompare(b.roomName)),
        });

        totalIssued += floorIssued;
        totalReturned += floorReturned;
        totalIssuedValue += floorIssuedValue;
        totalReturnedValue += floorReturnedValue;
      });

      return {
        totalIssued,
        totalReturned,
        totalIssuedValue,
        totalReturnedValue,
        floors: floorSummaries,
      };
    },
    enabled: !!projectId,
  });
};
