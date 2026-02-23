import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FloorDrawingRoom, DetectedRoom, RoomCoordinate } from "@/types/construction";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";
import { invokeEdgeFunction } from "@/lib/edgeFunctionClient";

// Helper to convert database row to typed FloorDrawingRoom
function mapDbRowToRoom(row: any): FloorDrawingRoom {
  return {
    ...row,
    coordinates: row.coordinates as RoomCoordinate[] | null,
  };
}

export function useFloorDrawingRooms(drawingId: string | null) {
  return useQuery({
    queryKey: ["floor-drawing-rooms", drawingId],
    queryFn: async () => {
      if (!drawingId) return [];
      
      const { data, error } = await supabase
        .from("floor_drawing_rooms")
        .select("*")
        .eq("floor_drawing_id", drawingId)
        .order("room_name");
      
      if (error) throw error;
      return (data || []).map(mapDbRowToRoom);
    },
    enabled: !!drawingId,
  });
}

export function useDetectRooms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      drawingId, 
      imageUrl, 
      totalAreaSqm 
    }: { 
      drawingId: string; 
      imageUrl: string; 
      totalAreaSqm?: number;
    }) => {
      // Call the edge function
      const { data: functionData, error: functionError, suggestion } = await invokeEdgeFunction(
        'analyze-floor-plan',
        {
          body: { imageUrl, totalAreaSqm }
        }
      );

      if (functionError) {
        console.error('Edge function error:', functionError);
        throw new Error(suggestion || functionError.message || 'Failed to analyze floor plan');
      }

      if (!functionData.success) {
        throw new Error(functionData.error || 'Failed to detect rooms');
      }

      const detectedRooms: DetectedRoom[] = functionData.rooms;

      // Delete existing rooms for this drawing
      const { error: deleteError } = await supabase
        .from("floor_drawing_rooms")
        .delete()
        .eq("floor_drawing_id", drawingId);

      if (deleteError) {
        console.error('Error deleting existing rooms:', deleteError);
        throw deleteError;
      }

      // Insert new detected rooms
      const roomsToInsert = detectedRooms.map(room => ({
        floor_drawing_id: drawingId,
        room_name: room.room_name,
        room_type: room.room_type,
        area_sqm: room.area_sqm,
        area_sqft: room.area_sqft,
        center_x: room.center_x,
        center_y: room.center_y,
        width_percent: room.width_percent,
        height_percent: room.height_percent,
        color: room.color,
      }));

      const { data: insertedRooms, error: insertError } = await supabase
        .from("floor_drawing_rooms")
        .insert(roomsToInsert)
        .select();

      if (insertError) {
        console.error('Error inserting rooms:', insertError);
        throw insertError;
      }

      return (insertedRooms || []).map(mapDbRowToRoom);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["floor-drawing-rooms", variables.drawingId] });
      toast.success(`Detected ${data.length} rooms successfully`);
    },
    onError: (error: Error) => {
      console.error('Room detection error:', error);
      if (error.message.includes('Rate limit')) {
        toast.error('Rate limit exceeded. Please try again later.');
      } else if (error.message.includes('credits')) {
        toast.error('AI credits exhausted. Please add credits to continue.');
      } else {
        toast.error(error.message || 'Failed to detect rooms');
      }
    },
  });
}

// Room type color mapping
const ROOM_TYPE_COLORS: Record<string, string> = {
  bedroom: '#6366F1',
  bathroom: '#06B6D4',
  kitchen: '#F97316',
  living: '#22C55E',
  dining: '#EAB308',
  office: '#8B5CF6',
  storage: '#78716C',
  garage: '#64748B',
  balcony: '#14B8A6',
  other: '#EC4899',
};

export function getRoomTypeColor(roomType: string): string {
  return ROOM_TYPE_COLORS[roomType.toLowerCase()] || ROOM_TYPE_COLORS.other;
}

export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      drawingId,
      roomName,
      roomType,
      areaSqm,
      coordinates,
    }: {
      drawingId: string;
      roomName: string;
      roomType: string;
      areaSqm?: number;
      coordinates: RoomCoordinate[];
    }) => {
      // Calculate bounding box from coordinates
      const xCoords = coordinates.map(c => c.x);
      const yCoords = coordinates.map(c => c.y);
      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const widthPercent = maxX - minX;
      const heightPercent = maxY - minY;

      const color = getRoomTypeColor(roomType);
      const areaSqft = areaSqm ? areaSqm * 10.764 : null;

      const { data, error } = await supabase
        .from("floor_drawing_rooms")
        .insert({
          floor_drawing_id: drawingId,
          room_name: roomName,
          room_type: roomType,
          area_sqm: areaSqm || null,
          area_sqft: areaSqft,
          center_x: centerX,
          center_y: centerY,
          width_percent: widthPercent,
          height_percent: heightPercent,
          color,
          coordinates: coordinates as unknown as Json[],
        })
        .select()
        .single();

      if (error) throw error;
      return mapDbRowToRoom(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["floor-drawing-rooms", variables.drawingId] });
      toast.success("Room added successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add room");
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomId: string) => {
      const { error } = await supabase
        .from("floor_drawing_rooms")
        .delete()
        .eq("id", roomId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floor-drawing-rooms"] });
      toast.success("Room deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete room");
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      roomId, 
      updates 
    }: { 
      roomId: string; 
      updates: { room_name?: string; room_type?: string };
    }) => {
      const { data, error } = await supabase
        .from("floor_drawing_rooms")
        .update(updates)
        .eq("id", roomId)
        .select()
        .single();

      if (error) throw error;
      return mapDbRowToRoom(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["floor-drawing-rooms"] });
      toast.success("Room updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update room");
    },
  });
}
