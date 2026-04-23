import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ItemCategory, CreateItemCategoryData } from '@/types/itemBin';
import { useToast } from '@/hooks/use-toast';
import { useMemo } from 'react';

export const useItemCategories = (companyId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all categories
  const {
    data: allCategories = [],
    isLoading: isCategoriesLoading,
    error: categoriesError
  } = useQuery({
    queryKey: ['item-categories', companyId],
    queryFn: async () => {
      let query = supabase
        .from('item_categories')
        .select('*');

      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) throw error;
      return data as ItemCategory[];
    }
  });

  // Fetch excluded category IDs for this company
  const {
    data: excludedCategoryIds = [],
    isLoading: isExcludedLoading
  } = useQuery({
    queryKey: ['excluded-categories', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('company_excluded_categories')
        .select('category_id')
        .eq('company_id', companyId);
      if (error) throw error;
      return data.map(e => e.category_id);
    },
    enabled: !!companyId
  });

  // Filter categories using useMemo to avoid recalculating on every render
  const categories = useMemo(() => 
    allCategories.filter(cat => !excludedCategoryIds.includes(cat.id)),
    [allCategories, excludedCategoryIds]
  );
  
  const hiddenCategories = useMemo(() => 
    allCategories.filter(cat => excludedCategoryIds.includes(cat.id)),
    [allCategories, excludedCategoryIds]
  );

  const isLoading = isCategoriesLoading || isExcludedLoading;
  const error = categoriesError;

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

      const categoriesByLevel = categoriesData.reduce((acc, category) => {
        const level = category.level || 0;
        if (!acc[level]) acc[level] = [];
        acc[level].push(category);
        return acc;
      }, {} as Record<number, Array<CreateItemCategoryData & { level: number; parentName?: string; company_id?: string }>>);

      const nameToIdMap = new Map<string, string>();
      const results = [];

      const levels = Object.keys(categoriesByLevel).map(Number).sort();
      
      for (const level of levels) {
        const levelCategories = categoriesByLevel[level];
        
        for (const categoryData of levelCategories) {
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
      // Pre-flight guard: refuse to delete a category that has subcategories.
      // Hierarchical master data must never be implicitly orphaned (SAP MM / ISO 55000).
      const childCount = allCategories.filter((c) => c.parent_id === categoryId).length;
      if (childCount > 0) {
        const err = new Error(
          `This category has ${childCount} subcategor${childCount === 1 ? 'y' : 'ies'}. Delete or reassign them first.`
        );
        (err as any).code = 'HAS_CHILDREN';
        throw err;
      }

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
      
      let errorMessage = "Failed to delete category. Please try again.";
      if (error?.code === 'HAS_CHILDREN') {
        errorMessage = error.message;
      } else if (error?.code === '23503') {
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

  const moveCategoryMutation = useMutation({
    mutationFn: async ({ id, newParentId }: { id: string; newParentId: string | null }) => {
      // Client-side guards (DB trigger enforces these too as a safety net).
      if (newParentId === id) {
        throw new Error('A category cannot be its own parent.');
      }
      if (newParentId) {
        // Cycle check
        const descendants = new Set<string>();
        const stack = [id];
        while (stack.length) {
          const cur = stack.pop()!;
          allCategories
            .filter((c) => c.parent_id === cur)
            .forEach((c) => {
              if (!descendants.has(c.id)) {
                descendants.add(c.id);
                stack.push(c.id);
              }
            });
        }
        if (descendants.has(newParentId)) {
          throw new Error('Move would create a cycle in the category tree.');
        }
        // Depth check: a parent (has children) cannot be moved under another category
        const sourceHasChildren = allCategories.some((c) => c.parent_id === id);
        if (sourceHasChildren) {
          throw new Error('This category has subcategories. Move it to Top Level instead.');
        }
        // The intended parent must itself be Level 0 (no parent)
        const target = allCategories.find((c) => c.id === newParentId);
        if (target?.parent_id) {
          throw new Error('Destination must be a Level 0 category.');
        }
        // Global source can only sit under a global parent
        const source = allCategories.find((c) => c.id === id);
        if (source && !source.company_id && target && target.company_id) {
          throw new Error('A global category can only be moved under another global category.');
        }
      }

      const { error } = await supabase
        .from('item_categories')
        .update({ parent_id: newParentId })
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, newParentId }: { id: string; newParentId: string | null }) => {
      const key = ['item-categories', companyId];
      // Cancel in-flight refetches so they can't overwrite our optimistic snapshot
      await queryClient.cancelQueries({ queryKey: key });

      const previous = queryClient.getQueryData<ItemCategory[]>(key);
      if (previous) {
        queryClient.setQueryData<ItemCategory[]>(
          key,
          previous.map((c) => (c.id === id ? { ...c, parent_id: newParentId } : c)),
        );
      }
      return { previous };
    },
    onError: (error: any, _vars, context: any) => {
      console.error('Error moving category:', error);
      // Roll back to the snapshot
      if (context?.previous) {
        queryClient.setQueryData(['item-categories', companyId], context.previous);
      }
      toast({
        title: 'Move failed',
        description: error?.message ?? 'Could not move category. Reverted.',
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Category moved',
        description: 'Hierarchy updated successfully.',
      });
    },
    onSettled: () => {
      // Reconcile with server on success or failure
      queryClient.invalidateQueries({ queryKey: ['item-categories', companyId] });
    },
  });

  const excludeCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      if (!companyId) throw new Error('No company selected');
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('company_excluded_categories')
        .insert({
          company_id: companyId,
          category_id: categoryId,
          excluded_by: user?.id
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excluded-categories', companyId] });
      queryClient.invalidateQueries({ queryKey: ['item-categories', companyId] });
      toast({
        title: "Category Hidden",
        description: "Category has been removed from this company's view.",
      });
    },
    onError: (error) => {
      console.error('Error hiding category:', error);
      toast({
        title: "Error",
        description: "Failed to hide category. Please try again.",
        variant: "destructive",
      });
    }
  });

  const restoreCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      if (!companyId) throw new Error('No company selected');
      
      const { error } = await supabase
        .from('company_excluded_categories')
        .delete()
        .eq('company_id', companyId)
        .eq('category_id', categoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excluded-categories', companyId] });
      queryClient.invalidateQueries({ queryKey: ['item-categories', companyId] });
      toast({
        title: "Category Restored",
        description: "Category is now visible for this company.",
      });
    },
    onError: (error) => {
      console.error('Error restoring category:', error);
      toast({
        title: "Error",
        description: "Failed to restore category. Please try again.",
        variant: "destructive",
      });
    }
  });

  const bulkUpdateVisibilityMutation = useMutation({
    mutationFn: async ({ toExclude, toRestore }: { toExclude: string[], toRestore: string[] }) => {
      if (!companyId) throw new Error('No company selected');
      const { data: { user } } = await supabase.auth.getUser();

      // Restore categories (delete exclusions)
      if (toRestore.length > 0) {
        const { error: restoreError } = await supabase
          .from('company_excluded_categories')
          .delete()
          .eq('company_id', companyId)
          .in('category_id', toRestore);
        if (restoreError) throw restoreError;
      }

      // Exclude categories (insert exclusions)
      if (toExclude.length > 0) {
        const inserts = toExclude.map(id => ({
          company_id: companyId,
          category_id: id,
          excluded_by: user?.id
        }));
        
        const { error: excludeError } = await supabase
          .from('company_excluded_categories')
          .upsert(inserts, { onConflict: 'company_id,category_id' });
        if (excludeError) throw excludeError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['excluded-categories', companyId] });
      queryClient.invalidateQueries({ queryKey: ['item-categories', companyId] });
      const totalChanges = variables.toExclude.length + variables.toRestore.length;
      toast({
        title: "Visibility Updated",
        description: `Updated visibility for ${totalChanges} categories.`,
      });
    },
    onError: (error) => {
      console.error('Error updating category visibility:', error);
      toast({
        title: "Error",
        description: "Failed to update category visibility. Please try again.",
        variant: "destructive",
      });
    }
  });

  return {
    categories,
    hiddenCategories,
    allCategories,
    excludedCategoryIds,
    isLoading,
    error,
    createCategory: createCategoryMutation.mutate,
    isCreating: createCategoryMutation.isPending,
    bulkImportCategories: bulkImportCategoriesMutation.mutate,
    isImporting: bulkImportCategoriesMutation.isPending,
    deleteCategory: deleteCategoryMutation.mutate,
    isDeleting: deleteCategoryMutation.isPending,
    excludeCategory: excludeCategoryMutation.mutate,
    isExcluding: excludeCategoryMutation.isPending,
    restoreCategory: restoreCategoryMutation.mutate,
    isRestoring: restoreCategoryMutation.isPending,
    bulkUpdateVisibility: bulkUpdateVisibilityMutation.mutateAsync,
    isBulkUpdating: bulkUpdateVisibilityMutation.isPending,
    moveCategory: moveCategoryMutation.mutate,
    isMoving: moveCategoryMutation.isPending,
  };
};
