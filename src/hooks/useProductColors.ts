import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProductColor } from "@/types/productMaster";
import { useCompany } from "@/contexts/CompanyContext";

export function useProductColors() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();

  const { data: colors = [], isLoading, error } = useQuery({
    queryKey: ['product-colors', selectedCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from('product_colors')
        .select('*')
        .eq('is_active', true)
        .order('color_name');

      if (selectedCompany?.id) {
        query = query.eq('company_id', selectedCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProductColor[];
    },
  });

  const createColorMutation = useMutation({
    mutationFn: async (colorName: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('product_colors')
        .insert({
          color_name: colorName.trim(),
          company_id: selectedCompany?.id,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-colors'] });
      toast({
        title: "Success",
        description: "Color added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add color",
        variant: "destructive",
      });
    },
  });

  return {
    colors,
    isLoading,
    error,
    createColor: createColorMutation.mutate,
    isCreating: createColorMutation.isPending,
  };
}
