import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FloorRoomStage, RoomStageStatus, DEFAULT_ROOM_STAGES } from '@/types/construction';
import { useToast } from '@/hooks/use-toast';

const mapDbRowToStage = (row: any): FloorRoomStage => ({
  id: row.id,
  room_id: row.room_id,
  company_id: row.company_id,
  stage_order: row.stage_order,
  stage_name: row.stage_name,
  description: row.description,
  status: row.status as RoomStageStatus,
  completion_percentage: row.completion_percentage,
  planned_start_date: row.planned_start_date,
  planned_end_date: row.planned_end_date,
  actual_start_date: row.actual_start_date,
  actual_end_date: row.actual_end_date,
  assigned_to: row.assigned_to,
  notes: row.notes,
  created_by: row.created_by,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export function useRoomStages(roomId: string | null) {
  return useQuery({
    queryKey: ['room-stages', roomId],
    queryFn: async () => {
      if (!roomId) return [];
      
      const { data, error } = await supabase
        .from('floor_room_stages')
        .select('*')
        .eq('room_id', roomId)
        .order('stage_order', { ascending: true });

      if (error) throw error;
      return (data || []).map(mapDbRowToStage);
    },
    enabled: !!roomId,
  });
}

export function useCreateRoomStage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      room_id: string;
      stage_name: string;
      description?: string;
      stage_order: number;
      company_id?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('floor_room_stages')
        .insert({
          room_id: data.room_id,
          stage_name: data.stage_name,
          description: data.description || null,
          stage_order: data.stage_order,
          company_id: data.company_id || null,
          status: 'pending',
          completion_percentage: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return mapDbRowToStage(result);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['room-stages', variables.room_id] });
      toast({ title: 'Stage added successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to add stage', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateRoomStage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      room_id: string;
      stage_name?: string;
      description?: string;
      status?: RoomStageStatus;
      completion_percentage?: number;
      planned_start_date?: string | null;
      planned_end_date?: string | null;
      actual_start_date?: string | null;
      actual_end_date?: string | null;
      notes?: string;
    }) => {
      const { id, room_id, ...updateData } = data;
      
      // Auto-set completion percentage based on status
      if (updateData.status === 'completed' && updateData.completion_percentage === undefined) {
        updateData.completion_percentage = 100;
      }
      if (updateData.status === 'pending' && updateData.completion_percentage === undefined) {
        updateData.completion_percentage = 0;
      }

      const { data: result, error } = await supabase
        .from('floor_room_stages')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...mapDbRowToStage(result), room_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['room-stages', result.room_id] });
      toast({ title: 'Stage updated successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update stage', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteRoomStage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { id: string; room_id: string }) => {
      const { error } = await supabase
        .from('floor_room_stages')
        .delete()
        .eq('id', data.id);

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['room-stages', data.room_id] });
      toast({ title: 'Stage deleted successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete stage', description: error.message, variant: 'destructive' });
    },
  });
}

export function useAddDefaultStages() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { room_id: string; company_id?: string }) => {
      const stagesToInsert = DEFAULT_ROOM_STAGES.map((stage, index) => ({
        room_id: data.room_id,
        company_id: data.company_id || null,
        stage_order: index + 1,
        stage_name: stage.stage_name,
        description: stage.description,
        status: 'pending',
        completion_percentage: 0,
      }));

      const { data: result, error } = await supabase
        .from('floor_room_stages')
        .insert(stagesToInsert)
        .select();

      if (error) throw error;
      return { room_id: data.room_id, stages: result };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['room-stages', data.room_id] });
      toast({ title: 'Default stages added successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to add default stages', description: error.message, variant: 'destructive' });
    },
  });
}
