import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FloorRoomMaterial, RoomMaterialStatus } from '@/types/construction';
import { toast } from 'sonner';
import { flattenCatalog } from '@/lib/flattenWarehouseItem';

export const useRoomMaterials = (roomId: string | null) => {
  return useQuery({
    queryKey: ['room-materials', roomId],
    queryFn: async () => {
      if (!roomId) return [];
      
      const { data, error } = await supabase
        .from('floor_room_materials')
        .select(`
          *,
          warehouse_item:warehouse_items(
            id,
            current_stock,
            unit_cost,
            catalog:warehouse_item_catalog!warehouse_items_catalog_item_id_fkey(item_code, name)
          )
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      // Item code and name live on the catalogue row.
      return (data ?? []).map((m: any) => ({ ...m, warehouse_item: flattenCatalog(m.warehouse_item) })) as unknown as FloorRoomMaterial[];
    },
    enabled: !!roomId,
  });
};

interface CreateRoomMaterialData {
  room_id: string;
  warehouse_item_id: string;
  company_id?: string;
  quantity_required: number;
  unit_cost?: number;
  notes?: string;
}

export const useCreateRoomMaterial = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateRoomMaterialData) => {
      const total_cost = data.unit_cost ? data.quantity_required * data.unit_cost : null;
      
      const { data: result, error } = await supabase
        .from('floor_room_materials')
        .insert({
          ...data,
          total_cost,
          status: 'planned' as unknown as RoomMaterialStatus,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['room-materials', variables.room_id] });
      toast.success('Material added to room');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('This material is already added to this room');
      } else {
        toast.error('Failed to add material: ' + error.message);
      }
    },
  });
};

interface UpdateRoomMaterialData {
  id: string;
  room_id: string;
  quantity_required?: number;
  quantity_allocated?: number;
  quantity_used?: number;
  unit_cost?: number;
  status?: RoomMaterialStatus;
  notes?: string;
}

export const useUpdateRoomMaterial = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: UpdateRoomMaterialData) => {
      const { id, room_id, ...updateData } = data;
      
      // Recalculate total cost if quantity or unit cost changed
      let total_cost: number | undefined;
      if (updateData.quantity_required !== undefined || updateData.unit_cost !== undefined) {
        const qty = updateData.quantity_required;
        const cost = updateData.unit_cost;
        if (qty !== undefined && cost !== undefined) {
          total_cost = qty * cost;
        }
      }
      
      const { data: result, error } = await supabase
        .from('floor_room_materials')
        .update({
          ...updateData,
          ...(total_cost !== undefined && { total_cost }),
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { result, room_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['room-materials', data.room_id] });
      toast.success('Material updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update material: ' + error.message);
    },
  });
};

export const useDeleteRoomMaterial = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, room_id }: { id: string; room_id: string }) => {
      const { error } = await supabase
        .from('floor_room_materials')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { room_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['room-materials', data.room_id] });
      toast.success('Material removed from room');
    },
    onError: (error: Error) => {
      toast.error('Failed to remove material: ' + error.message);
    },
  });
};

export const useRoomMaterialsSummary = (roomId: string | null) => {
  return useQuery({
    queryKey: ['room-materials-summary', roomId],
    queryFn: async () => {
      if (!roomId) return { count: 0, totalCost: 0 };
      
      const { data, error } = await supabase
        .from('floor_room_materials')
        .select('total_cost')
        .eq('room_id', roomId);
      
      if (error) throw error;
      
      const count = data.length;
      const totalCost = data.reduce((sum, item) => sum + (item.total_cost || 0), 0);
      
      return { count, totalCost };
    },
    enabled: !!roomId,
  });
};
