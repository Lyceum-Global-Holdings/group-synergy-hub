import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCachedUser } from "@/lib/currentUser";
import { useToast } from '@/hooks/use-toast';

export interface ProductColor {
  id: string;
  color_name: string;
  color_code: string;
  created_at: string;
  company_id?: string;
  created_by?: string;
}

export interface CreateColorData {
  color_name: string;
  color_code: string;
  company_id?: string;
}

export function useProductColors(companyId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: colors, isLoading, error } = useQuery({
    queryKey: ['product-colors', companyId],
    queryFn: async () => {
      let query = supabase
        .from('product_colors')
        .select('*');

      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }

      const { data, error } = await query.order('color_name', { ascending: true });

      if (error) throw error;
      return data as ProductColor[];
    },
  });

  const createColorMutation = useMutation({
    mutationFn: async (data: CreateColorData) => {
      const user = { user: getCachedUser() };
      
      const { data: result, error } = await supabase
        .from('product_colors')
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
      queryClient.invalidateQueries({ queryKey: ['product-colors'] });
      toast({
        title: "Success",
        description: "Color added successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error creating color:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create color",
        variant: "destructive",
      });
    },
  });

  const deleteColorMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_colors')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-colors'] });
      toast({
        title: "Success",
        description: "Color deleted successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error deleting color:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete color",
        variant: "destructive",
      });
    },
  });

  return {
    colors,
    isLoading,
    error,
    createColor: createColorMutation.mutate,
    deleteColor: deleteColorMutation.mutate,
    isCreating: createColorMutation.isPending,
    isDeleting: deleteColorMutation.isPending,
  };
}
