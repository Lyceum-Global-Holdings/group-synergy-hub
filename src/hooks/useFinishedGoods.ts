import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FinishedGood {
  id: string;
  product_name: string;
  product_code: string;
  style_no?: string;
  size?: string;
  color?: string;
  available_sizes?: string[];
  variant?: string;
  description?: string;
  category?: string;
  unit_of_measure: string;
  selling_price?: number;
  standard_cost?: number;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  minimum_stock?: number;
  maximum_stock?: number;
  reorder_point?: number;
  lead_time_days?: number;
  quality_status: string;
  status: string;
  location_id?: string;
  sublocation_id?: string;
  bin_id?: string;
  bom_id?: string;
  warehouse_item_id?: string;
  company_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFinishedGoodData {
  product_name: string;
  product_code: string;
  style_no?: string;
  size?: string;
  color?: string;
  variant?: string;
  description?: string;
  category?: string;
  unit_of_measure: string;
  selling_price?: number;
  standard_cost?: number;
  minimum_stock?: number;
  maximum_stock?: number;
  reorder_point?: number;
  lead_time_days?: number;
  quality_status?: string;
  status?: string;
  location_id?: string;
  sublocation_id?: string;
  bin_id?: string;
  bom_id?: string;
  warehouse_item_id?: string;
  company_id?: string;
}

export function useFinishedGoods(companyId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch finished goods
  const { data: products, isLoading, error } = useQuery({
    queryKey: ['finished-goods', companyId],
    queryFn: async () => {
      let query = supabase
        .from('finished_goods')
        .select('*');

      if (companyId) {
        // Include both company-specific items AND global items (company_id is null)
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FinishedGood[];
    },
  });

  // Create finished good
  const createProductMutation = useMutation({
    mutationFn: async (data: CreateFinishedGoodData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from('finished_goods')
        .insert([{
          ...data,
          created_by: user.user?.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finished-goods'] });
      toast({
        title: "Success",
        description: "Finished good created successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error creating finished good:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create finished good",
        variant: "destructive",
      });
    },
  });

  // Update finished good
  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateFinishedGoodData> }) => {
      const { data: result, error } = await supabase
        .from('finished_goods')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finished-goods'] });
      toast({
        title: "Success",
        description: "Finished good updated successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error updating finished good:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update finished good",
        variant: "destructive",
      });
    },
  });

  // Delete finished good
  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('finished_goods')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finished-goods'] });
      toast({
        title: "Success",
        description: "Finished good deleted successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting finished good:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete finished good",
        variant: "destructive",
      });
    },
  });

  return {
    products,
    isLoading,
    error,
    createProduct: createProductMutation.mutate,
    updateProduct: updateProductMutation.mutate,
    deleteProduct: deleteProductMutation.mutate,
    isCreating: createProductMutation.isPending,
    isUpdating: updateProductMutation.isPending,
    isDeleting: deleteProductMutation.isPending,
  };
}