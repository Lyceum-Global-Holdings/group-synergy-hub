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
        .select('*')
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
          items:grn_items(*)
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

      // If a GRN already exists for this PO (e.g., auto-generated on PO sent), reuse it
      let existingGrn: { id: string } | null = null;
      if (grnData.po_id) {
        const { data: foundGrn, error: findErr } = await supabase
          .from('goods_receipt_notes')
          .select('id, status')
          .eq('po_id', grnData.po_id)
          .in('status', ['draft', 'submitted'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!findErr && foundGrn) {
          existingGrn = { id: foundGrn.id };
        }
      }

      // Generate GRN number only when creating a new header
      let grnNumberStr = '';
      if (!existingGrn) {
        const { data: rpcNumber, error: numberError } = await supabase.rpc('generate_grn_number');
        if (!numberError && rpcNumber) {
          grnNumberStr = rpcNumber as string;
        } else {
          const now = new Date();
          const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
          const rand = Math.floor(1000 + Math.random() * 9000);
          grnNumberStr = `GRN-${yyyymmdd}-${rand}`;
        }
      }

      // Compute total value from incoming items (used as fallback; final total recalculated after item upserts)
      const totalValueFromPayload = (grnData.items || []).reduce((sum, item) => {
        const lineTotal = item.total_cost ?? ((item.unit_price || 0) * (item.quantity_received || 0));
        return sum + (lineTotal || 0);
      }, 0);

      // Create or reuse GRN header as draft first
      let targetGrnId: string;
      if (existingGrn) {
        targetGrnId = existingGrn.id;
        // Optionally update header details based on the form (keep number/status intact)
        const { error: headerUpdateErr } = await supabase
          .from('goods_receipt_notes')
          .update({
            grn_date: grnData.grn_date,
            invoice_number: grnData.invoice_number,
            invoice_date: grnData.invoice_date,
            pr_number: grnData.pr_number,
            mr_number: grnData.mr_number,
            supplier_id: grnData.supplier_id,
            supplier_name: grnData.supplier_name,
            supplier_address: grnData.supplier_address,
            branch: grnData.branch,
            remarks: grnData.remarks,
            company_id: grnData.company_id,
            received_by: user.id,
          })
          .eq('id', targetGrnId);
        if (headerUpdateErr) throw headerUpdateErr;
      } else {
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
            status: 'draft',
            total_value: totalValueFromPayload,
          })
          .select()
          .single();
        if (grnError) throw grnError;
        targetGrnId = grn.id as unknown as string;
      }

      // Upsert item lines: update if matching by (grn_id, po_item_id), else insert
      if (grnData.items.length > 0) {
        for (const item of grnData.items) {
          // Only process lines with a positive receipt quantity
          const qty = item.quantity_received || 0;
          const lineTotal = item.total_cost ?? ((item.unit_price || 0) * qty);

          if ((item.po_item_id || null) !== null) {
            // Check if an item exists for this PO item
            const { data: existingItem, error: findItemErr } = await supabase
              .from('grn_items')
              .select('id')
              .eq('grn_id', targetGrnId)
              .eq('po_item_id', item.po_item_id as string)
              .maybeSingle();
            if (findItemErr) throw findItemErr;

            if (existingItem) {
              const { error: updErr } = await supabase
                .from('grn_items')
                .update({
                  item_code: item.item_code,
                  item_name: item.item_name,
                  description: item.description,
                  warehouse_item_id: item.warehouse_item_id,
                  quantity_ordered: item.quantity_ordered,
                  quantity_received: qty,
                  unit_of_measure: item.unit_of_measure,
                  unit_price: item.unit_price,
                  total_cost: lineTotal,
                  quality_status: item.quality_status,
                  remarks: item.remarks,
                })
                .eq('id', existingItem.id);
              if (updErr) throw updErr;
              continue;
            }
          }

          // Insert new item if no po_item_id match (or no po_item_id provided)
          const { error: insErr } = await supabase
            .from('grn_items')
            .insert({
              grn_id: targetGrnId,
              item_code: item.item_code,
              item_name: item.item_name,
              description: item.description,
              warehouse_item_id: item.warehouse_item_id,
              po_item_id: item.po_item_id,
              quantity_ordered: item.quantity_ordered,
              quantity_received: qty,
              unit_of_measure: item.unit_of_measure,
              unit_price: item.unit_price,
              total_cost: lineTotal,
              quality_status: item.quality_status,
              remarks: item.remarks,
            });
          if (insErr) throw insErr;
        }
      }

      // Recalculate and persist total_value and move to submitted
      const { data: sumRows, error: sumErr } = await supabase
        .from('grn_items')
        .select('total_cost')
        .eq('grn_id', targetGrnId);
      if (sumErr) throw sumErr;
      const newTotal = (sumRows || []).reduce((s, r: any) => s + (r.total_cost || 0), 0);

      const { error: updateError } = await supabase
        .from('goods_receipt_notes')
        .update({ status: 'submitted', total_value: newTotal })
        .eq('id', targetGrnId);
      if (updateError) throw updateError;

      // Return the GRN header id to callers
      return { id: targetGrnId } as any;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipt-notes'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-items'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['grns-for-po'] });
      toast({
        title: "Success",
        description: "Goods Receipt Note created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating GRN:', error);
      toast({
        title: "Error",
        description: (error as any)?.message || "Failed to create Goods Receipt Note",
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