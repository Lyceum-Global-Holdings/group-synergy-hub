import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type MaterialTransactionType = 'allocation' | 'usage' | 'return' | 'adjustment';

export interface MaterialTransaction {
  id: string;
  room_material_id: string;
  transaction_type: MaterialTransactionType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
}

export const useRoomMaterialTransactions = (roomMaterialId: string | null) => {
  return useQuery({
    queryKey: ['room-material-transactions', roomMaterialId],
    queryFn: async () => {
      if (!roomMaterialId) return [];
      
      const { data, error } = await supabase
        .from('floor_room_material_transactions' as any)
        .select('*')
        .eq('room_material_id', roomMaterialId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as unknown as MaterialTransaction[];
    },
    enabled: !!roomMaterialId,
  });
};

interface CreateTransactionData {
  room_material_id: string;
  room_id: string;
  transaction_type: MaterialTransactionType;
  quantity: number;
  notes?: string;
}

export const useCreateMaterialTransaction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateTransactionData) => {
      // First, get the current material to determine previous quantities
      const { data: material, error: fetchError } = await supabase
        .from('floor_room_materials')
        .select('quantity_allocated, quantity_used')
        .eq('id', data.room_material_id)
        .single();
      
      if (fetchError) throw fetchError;
      
      const currentAllocated = material.quantity_allocated || 0;
      const currentUsed = material.quantity_used || 0;
      
      let previousQuantity: number;
      let newQuantity: number;
      let updateData: { quantity_allocated?: number; quantity_used?: number; status?: string } = {};
      
      switch (data.transaction_type) {
        case 'allocation':
          previousQuantity = currentAllocated;
          newQuantity = currentAllocated + data.quantity;
          updateData = { 
            quantity_allocated: newQuantity,
            status: newQuantity > 0 ? 'allocated' : 'planned'
          };
          break;
        case 'usage':
          previousQuantity = currentUsed;
          newQuantity = currentUsed + data.quantity;
          updateData = { 
            quantity_used: newQuantity,
            status: newQuantity >= currentAllocated ? 'fully_used' : 'partially_used'
          };
          break;
        case 'return':
          previousQuantity = currentUsed;
          newQuantity = Math.max(0, currentUsed - data.quantity);
          updateData = { 
            quantity_used: newQuantity,
            status: newQuantity === 0 ? 'allocated' : 'partially_used'
          };
          break;
        case 'adjustment':
          previousQuantity = currentAllocated;
          newQuantity = data.quantity; // For adjustment, quantity is the new absolute value
          updateData = { 
            quantity_allocated: newQuantity,
            status: newQuantity > 0 ? 'allocated' : 'planned'
          };
          break;
        default:
          throw new Error('Invalid transaction type');
      }
      
      // Create the transaction record
      const { data: transaction, error: transactionError } = await supabase
        .from('floor_room_material_transactions' as any)
        .insert({
          room_material_id: data.room_material_id,
          transaction_type: data.transaction_type,
          quantity: data.quantity,
          previous_quantity: previousQuantity,
          new_quantity: newQuantity,
          notes: data.notes || null,
        })
        .select()
        .single();
      
      if (transactionError) throw transactionError;
      
      // Update the material quantities
      const { error: updateError } = await supabase
        .from('floor_room_materials')
        .update(updateData)
        .eq('id', data.room_material_id);
      
      if (updateError) throw updateError;
      
      return { transaction, room_id: data.room_id };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['room-material-transactions', variables.room_material_id] });
      queryClient.invalidateQueries({ queryKey: ['room-materials', data.room_id] });
      
      const typeLabels: Record<MaterialTransactionType, string> = {
        allocation: 'Material allocated',
        usage: 'Usage recorded',
        return: 'Material returned',
        adjustment: 'Quantity adjusted',
      };
      toast.success(typeLabels[variables.transaction_type]);
    },
    onError: (error: Error) => {
      toast.error('Failed to record transaction: ' + error.message);
    },
  });
};
