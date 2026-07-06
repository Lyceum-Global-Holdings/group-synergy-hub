import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCachedUser } from "@/lib/currentUser";
import { AssetCategory, CreateAssetCategoryData } from '@/types/warehouse';
import { useToast } from '@/hooks/use-toast';

export const useAssetCategories = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: categories = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['asset-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('asset_categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as AssetCategory[];
    }
  });

  // Get main categories (no parent)
  const mainCategories = categories.filter(cat => !cat.parent_id);

  // Get subcategories for a specific parent
  const getSubcategories = (parentId: string) => 
    categories.filter(cat => cat.parent_id === parentId);

  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: CreateAssetCategoryData) => {
      const user = getCachedUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('asset_categories')
        .insert({
          ...categoryData,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
      toast({
        title: "Success",
        description: "Category created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating category:', error);
      toast({
        title: "Error",
        description: "Failed to create category",
        variant: "destructive",
      });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...categoryData }: Partial<AssetCategory> & { id: string }) => {
      const { data, error } = await supabase
        .from('asset_categories')
        .update(categoryData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating category:', error);
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('asset_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting category:', error);
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    }
  });

  return {
    categories,
    mainCategories,
    getSubcategories,
    isLoading,
    error,
    createCategory: createCategoryMutation.mutate,
    updateCategory: updateCategoryMutation.mutate,
    deleteCategory: deleteCategoryMutation.mutate,
    isCreating: createCategoryMutation.isPending,
    isUpdating: updateCategoryMutation.isPending,
    isDeleting: deleteCategoryMutation.isPending,
  };
};