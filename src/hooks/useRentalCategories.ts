import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RentalCategory, CreateRentalCategoryData } from "@/types/costumeRental";
import { toast } from "sonner";

export function useRentalCategories(companyId?: string) {
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading, error } = useQuery({
    queryKey: ["rental-categories", companyId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("rental_categories")
        .select("*")
        .order("name", { ascending: true });
      if (companyId) query = query.eq("company_id", companyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RentalCategory[];
    },
  });

  const createCategory = useMutation({
    mutationFn: async (input: CreateRentalCategoryData) => {
      const user = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("rental_categories")
        .insert({ ...input, created_by: user.data.user?.id })
        .select()
        .single();
      if (error) throw error;
      return data as RentalCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rental-categories"] });
      toast.success("Category created");
    },
    onError: (e: any) => toast.error(`Failed to create category: ${e.message}`),
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<CreateRentalCategoryData>) => {
      const { data, error } = await (supabase as any)
        .from("rental_categories")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as RentalCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rental-categories"] });
      toast.success("Category updated");
    },
    onError: (e: any) => toast.error(`Failed to update category: ${e.message}`),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("rental_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rental-categories"] });
      toast.success("Category deleted");
    },
    onError: (e: any) => toast.error(`Failed to delete category: ${e.message}`),
  });

  return {
    categories,
    isLoading,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
    isCreating: createCategory.isPending,
  };
}
