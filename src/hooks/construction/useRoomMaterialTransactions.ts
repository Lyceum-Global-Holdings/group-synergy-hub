import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { untypedRpc } from '@/lib/untypedRpc';

export type MaterialTransactionType = 'issue' | 'return' | 'adjustment';

export interface MaterialTransaction {
  id: string;
  room_material_id: string;
  warehouse_item_id: string;
  room_id: string;
  transaction_type: MaterialTransactionType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  previous_warehouse_stock: number | null;
  new_warehouse_stock: number | null;
  unit_cost: number | null;
  total_value: number | null;
  notes: string | null;
  performed_by: string | null;
  company_id: string | null;
  created_at: string;
}

export const useRoomMaterialTransactions = (roomMaterialId: string | null) => {
  return useQuery({
    queryKey: ['room-material-transactions', roomMaterialId],
    queryFn: async () => {
      if (!roomMaterialId) return [];
      
      const { data, error } = await supabase
        .from('floor_room_material_transactions')
        .select('*')
        .eq('room_material_id', roomMaterialId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as unknown as MaterialTransaction[];
    },
    enabled: !!roomMaterialId,
  });
};

// Issuing to a room goes through a Material Issue Note (request_room_materials):
// it reserves bin stock at the project's warehouse, an admin approves it and the
// store issues it; the room is updated when the MIN is issued. Returns go
// through a Material Return Note against that MIN (return_room_material).
export interface RequestRoomMaterialsData {
  room_id: string;
  location_id: string;
  lines: { room_material_id: string; quantity: number }[];
  notes?: string;
}

export const useRoomWarehouseOptions = (roomId: string | null) =>
  useQuery({
    queryKey: ['room-warehouse-options', roomId],
    queryFn: () => untypedRpc<{ id: string; name: string }[]>('room_warehouse_options', { p_room_id: roomId }),
    enabled: !!roomId,
  });

export const useIssueMaterial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RequestRoomMaterialsData) =>
      untypedRpc<string>('request_room_materials', {
        p_room_id: data.room_id,
        p_location_id: data.location_id,
        p_lines: data.lines,
        p_notes: data.notes || null,
      }),
    onSuccess: (_minId, variables) => {
      queryClient.invalidateQueries({ queryKey: ['room-materials', variables.room_id] });
      queryClient.invalidateQueries({ queryKey: ['material-issues'] });
      toast.success('Issue note submitted', {
        description: 'An admin approves it and the store issues it; the room is updated then.',
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export interface ReturnRoomMaterialData {
  room_id: string;
  room_material_id: string;
  quantity: number;
  condition: 'good' | 'damaged' | 'expired';
  reason: string;
}

export const useReturnMaterial = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReturnRoomMaterialData) =>
      untypedRpc<string>('return_room_material', {
        p_room_material_id: data.room_material_id,
        p_quantity: data.quantity,
        p_condition: data.condition,
        p_reason: data.reason,
      }),
    onSuccess: (_mrnId, variables) => {
      queryClient.invalidateQueries({ queryKey: ['room-materials', variables.room_id] });
      queryClient.invalidateQueries({ queryKey: ['material-returns'] });
      toast.success('Return note created', {
        description: 'Once an admin approves it, the stock goes back to its bin and the room is updated.',
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });
};

export const useCreateMaterialTransaction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      room_material_id: string;
      room_id: string;
      transaction_type: 'adjustment';
      quantity: number;
      notes?: string;
    }) => {
      const { data: material, error: fetchError } = await supabase
        .from('floor_room_materials')
        .select('quantity_allocated, warehouse_item_id')
        .eq('id', data.room_material_id)
        .single();
      
      if (fetchError) throw fetchError;
      
      const previousQuantity = material.quantity_allocated || 0;
      const newQuantity = data.quantity;
      
      const { error: transactionError } = await supabase
        .from('floor_room_material_transactions')
        .insert({
          room_material_id: data.room_material_id,
          warehouse_item_id: material.warehouse_item_id,
          room_id: data.room_id,
          transaction_type: 'adjustment',
          quantity: data.quantity,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,
          notes: data.notes || null,
        });
      
      if (transactionError) throw transactionError;
      
      const { error: updateError } = await supabase
        .from('floor_room_materials')
        .update({ 
          quantity_allocated: newQuantity,
          status: newQuantity > 0 ? 'allocated' : 'planned'
        })
        .eq('id', data.room_material_id);
      
      if (updateError) throw updateError;
      
      return { room_id: data.room_id };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['room-material-transactions', variables.room_material_id] });
      queryClient.invalidateQueries({ queryKey: ['room-materials', data.room_id] });
      toast.success('Quantity adjusted');
    },
    onError: (error: Error) => {
      toast.error('Failed to adjust quantity: ' + error.message);
    },
  });
};
