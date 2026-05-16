import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreateSupplierItemData, UpdateSupplierItemData, SupplierItemWithDetails } from "@/types/supplierItems";

export const useSupplierItems = (supplierId?: string) => {
  return useQuery({
    queryKey: ['supplier-items', supplierId],
    queryFn: async () => {
      let query = supabase
        .from('supplier_items')
        .select(`
          *,
          warehouse_item:warehouse_items(
            id,
            current_stock,
            catalog:warehouse_item_catalog!warehouse_items_catalog_item_id_fkey(item_code, name, category_id, unit_id)
          )
        `)
        .order('created_at', { ascending: false });

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as SupplierItemWithDetails[];
    },
    enabled: !!supplierId,
  });
};

export const useItemSuppliers = (warehouseItemId?: string) => {
  return useQuery({
    queryKey: ['item-suppliers', warehouseItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_items')
        .select(`
          *,
          supplier:suppliers(
            id,
            supplier_code,
            name,
            email,
            phone,
            status
          )
        `)
        .eq('warehouse_item_id', warehouseItemId)
        .order('is_preferred_supplier', { ascending: false })
        .order('supplier_unit_price', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!warehouseItemId,
  });
};

export const useCreateSupplierItem = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSupplierItemData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: result, error } = await supabase
        .from('supplier_items')
        .insert({
          ...data,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-items', variables.supplier_id] });
      queryClient.invalidateQueries({ queryKey: ['item-suppliers', variables.warehouse_item_id] });
      toast({
        title: "Success",
        description: "Item added to supplier catalog",
      });
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast({
          title: "Error",
          description: "This item is already in the supplier's catalog",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to add item to supplier",
          variant: "destructive",
        });
      }
    },
  });
};

export const useUpdateSupplierItem = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateSupplierItemData) => {
      const { data: result, error } = await supabase
        .from('supplier_items')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-items', data.supplier_id] });
      queryClient.invalidateQueries({ queryKey: ['item-suppliers', data.warehouse_item_id] });
      toast({
        title: "Success",
        description: "Supplier item updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update supplier item",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteSupplierItem = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, supplier_id, warehouse_item_id }: { id: string; supplier_id: string; warehouse_item_id: string }) => {
      const { error } = await supabase
        .from('supplier_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { supplier_id, warehouse_item_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-items', data.supplier_id] });
      queryClient.invalidateQueries({ queryKey: ['item-suppliers', data.warehouse_item_id] });
      toast({
        title: "Success",
        description: "Item removed from supplier catalog",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove item from supplier",
        variant: "destructive",
      });
    },
  });
};
