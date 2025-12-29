import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ItemCategory, CreateItemCategoryData } from '@/types/itemBin';
import { useToast } from '@/hooks/use-toast';

export const useItemCategories = (companyId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: categories = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['item-categories', companyId],
    queryFn: async () => {
      let query = supabase
        .from('item_categories')
        .select('*');

      if (companyId) {
        // Include company-specific AND global categories (company_id is null)
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) throw error;
      return data as ItemCategory[];
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: CreateItemCategoryData & { company_id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('item_categories')
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
      queryClient.invalidateQueries({ queryKey: ['item-categories', companyId] });
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

  const bulkImportCategoriesMutation = useMutation({
    mutationFn: async (categoriesData: Array<CreateItemCategoryData & { level: number; parentName?: string; company_id?: string }>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Group categories by level for hierarchical processing
      const categoriesByLevel = categoriesData.reduce((acc, category) => {
        const level = category.level || 0;
        if (!acc[level]) acc[level] = [];
        acc[level].push(category);
        return acc;
      }, {} as Record<number, Array<CreateItemCategoryData & { level: number; parentName?: string; company_id?: string }>>);

      // Map to store created category names to their database IDs
      const nameToIdMap = new Map<string, string>();
      const results = [];

      // Process categories level by level (parents first)
      const levels = Object.keys(categoriesByLevel).map(Number).sort();
      
      for (const level of levels) {
        const levelCategories = categoriesByLevel[level];
        
        for (const categoryData of levelCategories) {
          // Find parent ID if this is a subcategory
          let parent_id: string | undefined;
          if (categoryData.parentName && nameToIdMap.has(categoryData.parentName)) {
            parent_id = nameToIdMap.get(categoryData.parentName);
          }

          const { data, error } = await supabase
            .from('item_categories')
            .insert({
              name: categoryData.name,
              code: categoryData.code,
              description: categoryData.description,
              parent_id,
              company_id: categoryData.company_id || null,
              created_by: user.id
            })
            .select()
            .single();

          if (error) throw error;
          
          // Store the mapping for child categories
          nameToIdMap.set(categoryData.name, data.id);
          results.push(data);
        }
      }
      
      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['item-categories', companyId] });
      toast({
        title: "Success",
        description: `${data.length} categories imported successfully`,
      });
    },
    onError: (error) => {
      console.error('Error importing categories:', error);
      toast({
        title: "Error",
        description: "Failed to import categories",
        variant: "destructive",
      });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from('item_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories', companyId] });
      toast({
        title: "Success",
        description: "Category deleted successfully.",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting category:', error);
      
      // Check for foreign key constraint violation
      let errorMessage = "Failed to delete category. Please try again.";
      if (error?.code === '23503') {
        if (error?.details?.includes('warehouse_items')) {
          errorMessage = "Cannot delete this category because it has items assigned to it. Please reassign or delete those items first.";
        } else if (error?.details?.includes('product_master')) {
          errorMessage = "Cannot delete this category because it has products assigned to it. Please reassign or delete those products first.";
        } else {
          errorMessage = "Cannot delete this category because it is being used elsewhere. Please remove all references first.";
        }
      }
      
      toast({
        title: "Cannot Delete Category",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  return {
    categories,
    isLoading,
    error,
    createCategory: createCategoryMutation.mutate,
    isCreating: createCategoryMutation.isPending,
    bulkImportCategories: bulkImportCategoriesMutation.mutate,
    isImporting: bulkImportCategoriesMutation.isPending,
    deleteCategory: deleteCategoryMutation.mutate,
    isDeleting: deleteCategoryMutation.isPending,
  };
};