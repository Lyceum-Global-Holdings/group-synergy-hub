import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GoodsReceiptNote, GrnWithItems, CreateGrnData, GrnSummary } from '@/types/grn';

export const useGoodsReceiptNotes = () => {
  const { toast } = useToast();

  const {
    data: grns = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['goods-receipt-notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goods_receipt_notes')
        .select(`
          *,
          supplier:suppliers(name, address),
          purchase_order:purchase_orders(po_number)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as GoodsReceiptNote[];
    }
  });

  return {
    grns,
    isLoading,
    error,
  };
};

export const useGoodsReceiptNote = (id: string) => {
  return useQuery({
    queryKey: ['goods-receipt-note', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goods_receipt_notes')
        .select(`
          *,
          items:grn_items(*),
          supplier:suppliers(name, address),
          purchase_order:purchase_orders(po_number)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as GrnWithItems;
    },
    enabled: !!id
  });
};

export const useCreateGoodsReceiptNote = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (grnData: CreateGrnData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Generate GRN number with fallback
      let grnNumberStr = '';
      const { data: rpcNumber, error: numberError } = await supabase
        .rpc('generate_grn_number');
      if (!numberError && rpcNumber) {
        grnNumberStr = rpcNumber as string;
      } else {
        const now = new Date();
        const yyyymmdd = now.toISOString().slice(0,10).replace(/-/g,'');
        const rand = Math.floor(1000 + Math.random() * 9000);
        grnNumberStr = `GRN-${yyyymmdd}-${rand}`;
      }

      // Compute total value
      const totalValue = (grnData.items || []).reduce((sum, item) => {
        const lineTotal = item.total_cost ?? ((item.unit_price || 0) * (item.quantity_received || 0));
        return sum + (lineTotal || 0);
      }, 0);

      // Create GRN header
      const { data: grn, error: grnError } = await supabase
        .from('goods_receipt_notes')
        .insert({
          grn_number: grnNumberStr,
          grn_date: grnData.grn_date,
          invoice_number: grnData.invoice_number,
          invoice_date: grnData.invoice_date,
          po_id: grnData.po_id,
          po_number: grnData.po_number,
          pr_number: grnData.pr_number,
          mr_number: grnData.mr_number,
          supplier_id: grnData.supplier_id,
          supplier_name: grnData.supplier_name,
          supplier_address: grnData.supplier_address,
          branch: grnData.branch,
          remarks: grnData.remarks,
          company_id: grnData.company_id,
          received_by: user.id,
          created_by: user.id,
          status: 'submitted',
          total_value: totalValue
        })
        .select()
        .single();

      if (grnError) throw grnError;

      // Create GRN items
      if (grnData.items.length > 0) {
        const grnItems = grnData.items.map(item => ({
          grn_id: grn.id,
          item_code: item.item_code,
          item_name: item.item_name,
          description: item.description,
          warehouse_item_id: item.warehouse_item_id,
          po_item_id: item.po_item_id,
          quantity_ordered: item.quantity_ordered,
          quantity_received: item.quantity_received,
          unit_of_measure: item.unit_of_measure,
          unit_price: item.unit_price,
          total_cost: item.total_cost || (item.unit_price || 0) * item.quantity_received,
          quality_status: item.quality_status,
          remarks: item.remarks
        }));

        const { error: itemsError } = await supabase
          .from('grn_items')
          .insert(grnItems);

        if (itemsError) throw itemsError;
      }

      return grn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipt-notes'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      toast({
        title: "Success",
        description: "Goods Receipt Note created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating GRN:', error);
      toast({
        title: "Error",
        description: "Failed to create Goods Receipt Note",
        variant: "destructive",
      });
    }
  });
};

export const useUpdateGoodsReceiptNote = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<GoodsReceiptNote> }) => {
      const { data, error } = await supabase
        .from('goods_receipt_notes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipt-notes'] });
      toast({
        title: "Success",
        description: "GRN updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating GRN:', error);
      toast({
        title: "Error",
        description: "Failed to update GRN",
        variant: "destructive",
      });
    }
  });
};

export const useDeleteGoodsReceiptNote = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('goods_receipt_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipt-notes'] });
      toast({
        title: "Success",
        description: "GRN deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting GRN:', error);
      toast({
        title: "Error",
        description: "Failed to delete GRN",
        variant: "destructive",
      });
    }
  });
};

export const useGrnSummaryStats = () => {
  return useQuery({
    queryKey: ['grn-summary-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goods_receipt_notes')
        .select('status, total_value');

      if (error) throw error;

      const stats: GrnSummary = {
        total_grns: data.length,
        draft_grns: data.filter(grn => grn.status === 'draft').length,
        approved_grns: data.filter(grn => grn.status === 'approved').length,
        total_value: data.reduce((sum, grn) => sum + (grn.total_value || 0), 0)
      };

      return stats;
    }
  });
};