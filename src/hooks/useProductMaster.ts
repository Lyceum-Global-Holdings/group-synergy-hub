import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProductMaster, CreateProductMasterData, UpdateProductMasterData } from "@/types/productMaster";
import { useCompany } from "@/contexts/CompanyContext";

export function useProductMaster(companyId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const effectiveCompanyId = companyId || selectedCompany?.id;

  const { data: productMasters = [], isLoading, error } = useQuery({
    queryKey: ['product-masters', effectiveCompanyId],
    queryFn: async () => {
      let query = supabase
        .from('product_master')
        .select('*')
        .order('product_name');

      if (effectiveCompanyId) {
        query = query.eq('company_id', effectiveCompanyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProductMaster[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (productData: CreateProductMasterData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('product_master')
        .insert({
          ...productData,
          company_id: effectiveCompanyId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-masters'] });
      toast({
        title: "Success",
        description: "Product master created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create product master",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateProductMasterData) => {
      const { data, error } = await supabase
        .from('product_master')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-masters'] });
      toast({
        title: "Success",
        description: "Product master updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update product master",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_master')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-masters'] });
      toast({
        title: "Success",
        description: "Product master deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete product master",
        variant: "destructive",
      });
    },
  });

  return {
    productMasters,
    isLoading,
    error,
    createProductMaster: createMutation.mutate,
    isCreating: createMutation.isPending,
    updateProductMaster: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    deleteProductMaster: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
