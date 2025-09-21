import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { BillOfMaterials, CreateBomData, UpdateBomData } from '@/types/bom';

// Fetch BOMs
export function useBillOfMaterials() {
  return useQuery({
    queryKey: ['bill-of-materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bill_of_materials')
        .select(`
          *,
          items:bom_items(*),
          purchase_order:purchase_orders(
            po_number,
            supplier:suppliers(name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BillOfMaterials[];
    }
  });
}

// Create BOM
export function useCreateBillOfMaterials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBomData) => {
      // Generate BOM number
      const { data: bomNumber } = await supabase.rpc('generate_bom_number');
      
      const { data: bom, error: bomError } = await supabase
        .from('bill_of_materials')
        .insert({
          bom_number: bomNumber,
          po_id: data.po_id,
          company_id: data.company_id,
          product_name: data.product_name,
          description: data.description,
          version: data.version || '1.0',
          status: data.status,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (bomError) throw bomError;

      // Insert BOM items
      if (data.items.length > 0) {
        const { error: itemsError } = await supabase
          .from('bom_items')
          .insert(
            data.items.map(item => ({
              bom_id: bom.id,
              ...item
            }))
          );

        if (itemsError) throw itemsError;
      }

      return bom;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill-of-materials'] });
      toast.success('Bill of Materials created successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to create BOM: ' + error.message);
    }
  });
}

// Update BOM
export function useUpdateBillOfMaterials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateBomData) => {
      const { id, items, ...bomData } = data;
      
      const { error } = await supabase
        .from('bill_of_materials')
        .update(bomData)
        .eq('id', id);

      if (error) throw error;

      // Update items if provided
      if (items) {
        // Delete existing items and insert new ones
        await supabase.from('bom_items').delete().eq('bom_id', id);
        
        if (items.length > 0) {
          const { error: itemsError } = await supabase
            .from('bom_items')
            .insert(
              items.map(item => ({
                bom_id: id,
                ...item
              }))
            );

          if (itemsError) throw itemsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill-of-materials'] });
      toast.success('Bill of Materials updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update BOM: ' + error.message);
    }
  });
}

// Delete BOM
export function useDeleteBillOfMaterials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bill_of_materials')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bill-of-materials'] });
      toast.success('Bill of Materials deleted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to delete BOM: ' + error.message);
    }
  });
}