import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ItemCategory, CreateItemCategoryData } from '@/types/itemBin';
import { useToast } from '@/hooks/use-toast';

export const useItemCategories = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: categories = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['item-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_categories')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ItemCategory[];
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: CreateItemCategoryData) => {
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
      queryClient.invalidateQueries({ queryKey: ['item-categories'] });
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
    mutationFn: async (categoriesData: CreateItemCategoryData[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Import categories in order (parents first, then children)
      const results = [];
      for (const categoryData of categoriesData) {
        const { data, error } = await supabase
          .from('item_categories')
          .insert({
            ...categoryData,
            created_by: user.id
          })
          .select()
          .single();

        if (error) throw error;
        results.push(data);
      }
      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] });
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

  return {
    categories,
    isLoading,
    error,
    createCategory: createCategoryMutation.mutate,
    isCreating: createCategoryMutation.isPending,
    bulkImportCategories: bulkImportCategoriesMutation.mutate,
    isImporting: bulkImportCategoriesMutation.isPending,
  };
};