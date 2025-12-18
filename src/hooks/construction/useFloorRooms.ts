import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FloorDrawingRoom, DetectedRoom, RoomCoordinate } from "@/types/construction";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

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
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'analyze-floor-plan',
        {
          body: { imageUrl, totalAreaSqm }
        }
      );

      if (functionError) {
        console.error('Edge function error:', functionError);
        throw new Error(functionError.message || 'Failed to analyze floor plan');
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
