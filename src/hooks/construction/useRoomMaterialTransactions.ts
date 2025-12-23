import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

interface IssueMaterialData {
  room_material_id: string;
  room_id: string;
  warehouse_item_id: string;
  quantity: number;
  unit_cost?: number;
  company_id?: string;
  notes?: string;
}

export const useIssueMaterial = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: IssueMaterialData) => {
      // Get current user for RLS compliance
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get current warehouse stock
      const { data: warehouseItem, error: warehouseError } = await supabase
        .from('warehouse_items')
        .select('current_stock, unit_cost')
        .eq('id', data.warehouse_item_id)
        .single();
      
      if (warehouseError) throw warehouseError;
      
      const currentWarehouseStock = warehouseItem.current_stock || 0;
      
      // Validate stock availability
      if (data.quantity > currentWarehouseStock) {
        throw new Error(`Insufficient stock. Available: ${currentWarehouseStock}`);
      }
      
      // Get current room material quantities
      const { data: material, error: materialError } = await supabase
        .from('floor_room_materials')
        .select('quantity_allocated, quantity_used')
        .eq('id', data.room_material_id)
        .single();
      
      if (materialError) throw materialError;
      
      const previousAllocated = material.quantity_allocated || 0;
      const newAllocated = previousAllocated + data.quantity;
      const newWarehouseStock = currentWarehouseStock - data.quantity;
      const unitCost = data.unit_cost || warehouseItem.unit_cost || 0;
      
      // Create the transaction record in floor_room_material_transactions
      const { data: transaction, error: transactionError } = await supabase
        .from('floor_room_material_transactions')
        .insert({
          room_material_id: data.room_material_id,
          warehouse_item_id: data.warehouse_item_id,
          room_id: data.room_id,
          transaction_type: 'issue',
          quantity: data.quantity,
          previous_quantity: previousAllocated,
          new_quantity: newAllocated,
          previous_warehouse_stock: currentWarehouseStock,
          new_warehouse_stock: newWarehouseStock,
          unit_cost: unitCost,
          total_value: data.quantity * unitCost,
          notes: data.notes || null,
          company_id: data.company_id || null,
        })
        .select('id')
        .single();
      
      if (transactionError) throw transactionError;
      
      // Create stock_transactions record for warehouse stock movement history
      const { error: stockTransactionError } = await supabase
        .from('stock_transactions')
        .insert({
          item_id: data.warehouse_item_id,
          transaction_type: 'project_issue',
          reference_type: 'project',
          reference_id: transaction.id,
          quantity_change: -data.quantity,
          quantity_before: currentWarehouseStock,
          quantity_after: newWarehouseStock,
          unit_cost: unitCost,
          total_value: data.quantity * unitCost,
          notes: `Project Issue: ${data.notes || 'Material issued to project'}`,
          company_id: data.company_id || null,
          created_by: user?.id || null,
        });
      
      if (stockTransactionError) {
        console.error('Failed to create stock transaction:', stockTransactionError);
      }
      
      // Update warehouse stock
      const { error: updateWarehouseError } = await supabase
        .from('warehouse_items')
        .update({ current_stock: newWarehouseStock })
        .eq('id', data.warehouse_item_id);
      
      if (updateWarehouseError) throw updateWarehouseError;
      
      // Update room material quantities
      const { error: updateMaterialError } = await supabase
        .from('floor_room_materials')
        .update({ 
          quantity_allocated: newAllocated,
          status: 'allocated'
        })
        .eq('id', data.room_material_id);
      
      if (updateMaterialError) throw updateMaterialError;
      
      return { room_id: data.room_id };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['room-material-transactions', variables.room_material_id] });
      queryClient.invalidateQueries({ queryKey: ['room-materials', data.room_id] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transactions'] });
      toast.success('Material issued successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to issue material: ' + error.message);
    },
  });
};

interface ReturnMaterialData {
  room_material_id: string;
  room_id: string;
  warehouse_item_id: string;
  quantity: number;
  unit_cost?: number;
  company_id?: string;
  notes?: string;
}

export const useReturnMaterial = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: ReturnMaterialData) => {
      // Get current user for RLS compliance
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get current warehouse stock
      const { data: warehouseItem, error: warehouseError } = await supabase
        .from('warehouse_items')
        .select('current_stock, unit_cost')
        .eq('id', data.warehouse_item_id)
        .single();
      
      if (warehouseError) throw warehouseError;
      
      const currentWarehouseStock = warehouseItem.current_stock || 0;
      
      // Get current room material quantities
      const { data: material, error: materialError } = await supabase
        .from('floor_room_materials')
        .select('quantity_allocated, quantity_used')
        .eq('id', data.room_material_id)
        .single();
      
      if (materialError) throw materialError;
      
      const previousAllocated = material.quantity_allocated || 0;
      
      // Validate return quantity
      if (data.quantity > previousAllocated) {
        throw new Error(`Cannot return more than allocated. Allocated: ${previousAllocated}`);
      }
      
      const newAllocated = previousAllocated - data.quantity;
      const newWarehouseStock = currentWarehouseStock + data.quantity;
      const unitCost = data.unit_cost || warehouseItem.unit_cost || 0;
      
      // Create the transaction record in floor_room_material_transactions
      const { data: transaction, error: transactionError } = await supabase
        .from('floor_room_material_transactions')
        .insert({
          room_material_id: data.room_material_id,
          warehouse_item_id: data.warehouse_item_id,
          room_id: data.room_id,
          transaction_type: 'return',
          quantity: data.quantity,
          previous_quantity: previousAllocated,
          new_quantity: newAllocated,
          previous_warehouse_stock: currentWarehouseStock,
          new_warehouse_stock: newWarehouseStock,
          unit_cost: unitCost,
          total_value: data.quantity * unitCost,
          notes: data.notes || null,
          company_id: data.company_id || null,
        })
        .select('id')
        .single();
      
      if (transactionError) throw transactionError;
      
      // Create stock_transactions record for warehouse stock movement history
      const { error: stockTransactionError } = await supabase
        .from('stock_transactions')
        .insert({
          item_id: data.warehouse_item_id,
          transaction_type: 'project_return',
          reference_type: 'project',
          reference_id: transaction.id,
          quantity_change: data.quantity,
          quantity_before: currentWarehouseStock,
          quantity_after: newWarehouseStock,
          unit_cost: unitCost,
          total_value: data.quantity * unitCost,
          notes: `Project Return: ${data.notes || 'Material returned from project'}`,
          company_id: data.company_id || null,
          created_by: user?.id || null,
        });
      
      if (stockTransactionError) {
        console.error('Failed to create stock transaction:', stockTransactionError);
      }
      
      // Update warehouse stock
      const { error: updateWarehouseError } = await supabase
        .from('warehouse_items')
        .update({ current_stock: newWarehouseStock })
        .eq('id', data.warehouse_item_id);
      
      if (updateWarehouseError) throw updateWarehouseError;
      
      // Update room material quantities
      const { error: updateMaterialError } = await supabase
        .from('floor_room_materials')
        .update({ 
          quantity_allocated: newAllocated,
          status: newAllocated > 0 ? 'allocated' : 'planned'
        })
        .eq('id', data.room_material_id);
      
      if (updateMaterialError) throw updateMaterialError;
      
      return { room_id: data.room_id };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['room-material-transactions', variables.room_material_id] });
      queryClient.invalidateQueries({ queryKey: ['room-materials', data.room_id] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transactions'] });
      toast.success('Material returned successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to return material: ' + error.message);
    },
  });
};

// Legacy hook for backward compatibility
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
