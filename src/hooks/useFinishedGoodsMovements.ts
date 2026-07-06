import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCachedUser } from "@/lib/currentUser";
import { useToast } from '@/hooks/use-toast';

export interface FinishedGoodsMovement {
  id: string;
  finished_good_id: string;
  movement_type: string;
  reference_type: string | null;
  reference_number: string | null;
  reference_id: string | null;
  batch_id: string | null;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  unit_cost: number | null;
  total_value: number | null;
  from_location_id: string | null;
  to_location_id: string | null;
  notes: string | null;
  company_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFinishedGoodsMovementData {
  finished_good_id: string;
  movement_type: string;
  reference_type?: string;
  reference_number?: string;
  reference_id?: string;
  batch_id?: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  unit_cost?: number;
  total_value?: number;
  from_location_id?: string;
  to_location_id?: string;
  notes?: string;
  company_id?: string;
}

export const useFinishedGoodsMovements = (finishedGoodId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: movements = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['finished-goods-movements', finishedGoodId],
    queryFn: async () => {
      let query = supabase
        .from('finished_goods_movements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (finishedGoodId) {
        query = query.eq('finished_good_id', finishedGoodId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FinishedGoodsMovement[];
    }
  });

  const createMovementMutation = useMutation({
    mutationFn: async (movementData: CreateFinishedGoodsMovementData) => {
      const user = getCachedUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('finished_goods_movements')
        .insert({
          ...movementData,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finished-goods-movements'] });
      queryClient.invalidateQueries({ queryKey: ['finished-goods'] });
      toast({
        title: "Success",
        description: "Stock movement recorded successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating finished goods movement:', error);
      toast({
        title: "Error",
        description: "Failed to record stock movement",
        variant: "destructive",
      });
    }
  });

  return {
    movements,
    isLoading,
    error,
    createMovement: createMovementMutation.mutate,
    isCreating: createMovementMutation.isPending,
  };
};