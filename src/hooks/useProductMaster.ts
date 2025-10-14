import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProductMaster {
  id: string;
  product_name: string;
  product_code: string;
  style_no?: string | null;
  category_id?: string | null;
  description?: string | null;
  available_colors: any;
  available_sizes: any;
  default_unit_of_measure: string;
  image_url?: string | null;
  status: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  company_id?: string | null;
}

export interface CreateProductMasterData {
  product_name: string;
  product_code: string;
  style_no?: string;
  category_id?: string;
  description?: string;
  available_colors?: any[];
  available_sizes?: string[];
  default_unit_of_measure?: string;
  image_url?: string;
  status?: string;
  company_id?: string;
}

export function useProductMaster(companyId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products, isLoading, error } = useQuery({
    queryKey: ['product-master', companyId],
    queryFn: async () => {
      let query = supabase
        .from('product_master')
        .select('*');

      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data as any[] as ProductMaster[];
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: CreateProductMasterData) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from('product_master')
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
      queryClient.invalidateQueries({ queryKey: ['product-master'] });
      toast({
        title: "Success",
        description: "Product master created successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error creating product master:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create product master",
        variant: "destructive",
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateProductMasterData> }) => {
      const { data: result, error } = await supabase
        .from('product_master')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-master'] });
      toast({
        title: "Success",
        description: "Product master updated successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error updating product master:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update product master",
        variant: "destructive",
      });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_master')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-master'] });
      toast({
        title: "Success",
        description: "Product master deleted successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting product master:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete product master",
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
