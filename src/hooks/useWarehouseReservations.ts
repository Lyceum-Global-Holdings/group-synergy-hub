import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { 
import { flattenCatalog } from '@/lib/flattenWarehouseItem';
  WarehouseItemReservation, 
  CreateReservationData,
  BulkReservationRequest,
  ReservationWithDetails 
} from '@/types/warehouseReservation';

export function useWarehouseReservations() {
  const queryClient = useQueryClient();

  // Fetch all reservations with details
  const { data: reservations, isLoading, error } = useQuery({
    queryKey: ['warehouse-reservations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouse_item_reservations')
        .select(`
          *,
          warehouse_item:warehouse_items!warehouse_item_reservations_warehouse_item_id_fkey(
            id,
            current_stock,
            reserved_quantity,
            catalog:warehouse_item_catalog!warehouse_items_catalog_item_id_fkey(item_code, name)
          ),
          bin_allocation:warehouse_bin_allocations!warehouse_item_reservations_bin_allocation_id_fkey(
            allocated_quantity,
            available_quantity,
            bin:warehouse_bins!warehouse_bin_allocations_bin_id_fkey(
              bin_code,
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as ReservationWithDetails[];
    },
  });

  // Create single reservation
  const createReservationMutation = useMutation({
    mutationFn: async (data: CreateReservationData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: reservation, error } = await supabase
        .from('warehouse_item_reservations')
        .insert({
          ...data,
          reserved_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return reservation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast.success('Reservation created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create reservation: ${error.message}`);
    },
  });

  // Bulk create reservations for CPO
  const createBulkReservationsMutation = useMutation({
    mutationFn: async (request: BulkReservationRequest) => {
      const { data: user } = await supabase.auth.getUser();
      
      const reservations = request.items.map(item => ({
        warehouse_item_id: item.warehouse_item_id,
        bin_allocation_id: item.bin_allocation_id,
        reserved_quantity: item.required_quantity,
        reference_type: 'cpo' as const,
        reference_id: request.cpo_id,
        reference_number: request.cpo_number,
        required_date: request.required_date,
        bom_id: item.bom_id,
        bom_item_id: item.bom_item_id,
        notes: request.notes,
        reserved_by: user.user?.id,
      }));

      const { data, error } = await supabase
        .from('warehouse_item_reservations')
        .insert(reservations)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast.success(`Reserved ${variables.items.length} materials for CPO ${variables.cpo_number}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create bulk reservations: ${error.message}`);
    },
  });

  // Update reservation (for issuing materials)
  const updateReservationMutation = useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: string; 
      updates: Partial<WarehouseItemReservation> 
    }) => {
      const { data, error } = await supabase
        .from('warehouse_item_reservations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast.success('Reservation updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update reservation: ${error.message}`);
    },
  });

  // Issue materials from reservation
  const issueFromReservationMutation = useMutation({
    mutationFn: async ({
      reservationId,
      quantityIssued,
    }: {
      reservationId: string;
      quantityIssued: number;
    }) => {
      // Get current reservation
      const { data: reservation, error: fetchError } = await supabase
        .from('warehouse_item_reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      if (fetchError) throw fetchError;

      const newQuantityIssued = reservation.quantity_issued + quantityIssued;
      const newStatus = 
        newQuantityIssued >= reservation.reserved_quantity 
          ? 'issued' 
          : 'partially_issued';

      const { data, error } = await supabase
        .from('warehouse_item_reservations')
        .update({
          quantity_issued: newQuantityIssued,
          status: newStatus,
        })
        .eq('id', reservationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast.success('Materials issued from reservation');
    },
    onError: (error: Error) => {
      toast.error(`Failed to issue materials: ${error.message}`);
    },
  });

  // Cancel reservation
  const cancelReservationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('warehouse_item_reservations')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast.success('Reservation cancelled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to cancel reservation: ${error.message}`);
    },
  });

  // Delete reservation
  const deleteReservationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('warehouse_item_reservations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast.success('Reservation deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete reservation: ${error.message}`);
    },
  });

  // Get reservations by reference
  const getReservationsByReference = async (
    referenceType: string, 
    referenceId: string
  ) => {
    const { data, error } = await supabase
      .from('warehouse_item_reservations')
      .select(`
        *,
        warehouse_item:warehouse_items!warehouse_item_reservations_warehouse_item_id_fkey(
            id,
            current_stock,
            catalog:warehouse_item_catalog!warehouse_items_catalog_item_id_fkey(item_code, name)
          )
      `)
      .eq('reference_type', referenceType)
      .eq('reference_id', referenceId);

    if (error) throw error;
    return data as unknown as ReservationWithDetails[];
  };

  return {
    reservations,
    isLoading,
    error,
    createReservation: createReservationMutation.mutate,
    createBulkReservations: createBulkReservationsMutation.mutate,
    updateReservation: updateReservationMutation.mutate,
    issueFromReservation: issueFromReservationMutation.mutate,
    cancelReservation: cancelReservationMutation.mutate,
    deleteReservation: deleteReservationMutation.mutate,
    getReservationsByReference,
    isCreating: createReservationMutation.isPending,
    isCreatingBulk: createBulkReservationsMutation.isPending,
    isUpdating: updateReservationMutation.isPending,
    isIssuing: issueFromReservationMutation.isPending,
    isCancelling: cancelReservationMutation.isPending,
    isDeleting: deleteReservationMutation.isPending,
  };
}
