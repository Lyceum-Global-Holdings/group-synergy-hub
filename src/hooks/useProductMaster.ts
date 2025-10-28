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
  unit_of_measure: string;
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
  unit_of_measure?: string;
  image_url?: string;
  status?: string;
  company_id?: string;
}

// Helper function to calculate total possible variants for a product master
export function calculateTotalVariants(productMaster: ProductMaster): number {
  const sizes = productMaster.available_sizes?.length || 0;
  const colors = productMaster.available_colors?.length || 0;
  
  // If no sizes or colors defined, at least 1 variant is possible
  if (sizes === 0 && colors === 0) return 1;
  if (sizes === 0) return colors;
  if (colors === 0) return sizes;
  
  // Total combinations = sizes × colors
  return sizes * colors;
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

  // Query to get variant counts per product master
  const { data: variantCounts } = useQuery({
    queryKey: ['product-master-variants', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finished_goods')
        .select('product_master_id, size, color');
      
      if (error) throw error;
      
      // Group by product_master_id and count unique size+color combinations
      const counts = new Map<string, Set<string>>();
      
      data?.forEach((item) => {
        if (item.product_master_id) {
          if (!counts.has(item.product_master_id)) {
            counts.set(item.product_master_id, new Set());
          }
          const variantKey = `${item.size || 'All'}-${item.color || 'None'}`;
          counts.get(item.product_master_id)!.add(variantKey);
        }
      });
      
      // Convert to object with counts
      const result: Record<string, number> = {};
      counts.forEach((variants, productMasterId) => {
        result[productMasterId] = variants.size;
      });
      
      return result;
    },
    enabled: !!products,
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
    variantCounts,
    createProduct: createProductMutation.mutate,
    updateProduct: updateProductMutation.mutate,
    deleteProduct: deleteProductMutation.mutate,
    isCreating: createProductMutation.isPending,
    isUpdating: updateProductMutation.isPending,
    isDeleting: deleteProductMutation.isPending,
  };
}
