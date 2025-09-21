import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PurchaseOrder, CreatePoData, PoSummary, CreateReceiptData } from '@/types/purchaseOrder';

// Fetch all purchase orders
export function usePurchaseOrders() {
  return useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      console.log('Fetching purchase orders...');
      
      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('Current user:', user?.id, user?.email);
      
      if (authError) {
        console.error('Auth error:', authError);
        throw authError;
      }

      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(name, email, phone),
          pr:purchase_requisitions(pr_number, title),
          items:po_items(*)
        `)
        .order('created_at', { ascending: false });

      console.log('Purchase orders query result:', { data, error });
      if (error) {
        console.error('Purchase orders error:', error);
        throw error;
      }
      return data as PurchaseOrder[];
    },
  });
}

// Fetch single purchase order
export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(name, email, phone),
          pr:purchase_requisitions(pr_number, title),
          items:po_items(*),
          receipts:po_receipts(
            *,
            items:po_receipt_items(
              *,
              po_item:po_items(item_name, unit_of_measure)
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as PurchaseOrder;
    },
    enabled: !!id,
  });
}

// Create purchase order
export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreatePoData) => {
      // Generate PO number
      const { data: poNumber, error: numberError } = await supabase
        .rpc('generate_po_number');

      if (numberError) throw numberError;

      // Create PO
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: poNumber,
          pr_id: data.pr_id,
          supplier_id: data.supplier_id,
          expected_delivery_date: data.expected_delivery_date,
          payment_terms: data.payment_terms,
          delivery_terms: data.delivery_terms,
          currency: data.currency || 'LKR',
          buyer_id: data.buyer_id,
          notes: data.notes,
          created_by: (await supabase.auth.getUser()).data.user?.id!,
        })
        .select()
        .single();

      if (poError) throw poError;

      // Create PO items
      const poItems = data.items.map(item => ({
        po_id: po.id,
        pr_item_id: item.pr_item_id,
        item_name: item.item_name,
        description: item.description,
        specifications: item.specifications,
        quantity_ordered: item.quantity_ordered,
        unit_price: item.unit_price,
        total_price: item.total_price,
        unit_of_measure: item.unit_of_measure,
        delivery_date: item.delivery_date,
        notes: item.notes,
      }));

      const { error: itemsError } = await supabase
        .from('po_items')
        .insert(poItems);

      if (itemsError) throw itemsError;

      return po;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({
        title: "Success",
        description: "Purchase Order created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create Purchase Order",
        variant: "destructive",
      });
      console.error('Create PO error:', error);
    },
  });
}

// Update purchase order
export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PurchaseOrder> }) => {
      const { data: po, error } = await supabase
        .from('purchase_orders')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return po;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({
        title: "Success",
        description: "Purchase Order updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update Purchase Order",
        variant: "destructive",
      });
      console.error('Update PO error:', error);
    },
  });
}

// Send purchase order
export function useSendPurchaseOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .update({ status: 'sent' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({
        title: "Success",
        description: "Purchase Order sent successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send Purchase Order",
        variant: "destructive",
      });
      console.error('Send PO error:', error);
    },
  });
}

// Delete purchase order
export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({
        title: "Success",
        description: "Purchase Order deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete Purchase Order",
        variant: "destructive",
      });
      console.error('Delete PO error:', error);
    },
  });
}

// Create goods receipt
export function useCreateGoodsReceipt() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateReceiptData) => {
      const currentUser = await supabase.auth.getUser();
      
      // Create receipt
      const { data: receipt, error: receiptError } = await supabase
        .from('po_receipts')
        .insert({
          po_id: data.po_id,
          receipt_number: data.receipt_number,
          received_date: data.received_date,
          received_by: currentUser.data.user?.id!,
          notes: data.notes,
        })
        .select()
        .single();

      if (receiptError) throw receiptError;

      // Create receipt items
      const receiptItems = data.items.map(item => ({
        receipt_id: receipt.id,
        po_item_id: item.po_item_id,
        quantity_received: item.quantity_received,
        quality_status: item.quality_status,
        notes: item.notes,
      }));

      const { error: itemsError } = await supabase
        .from('po_receipt_items')
        .insert(receiptItems);

      if (itemsError) throw itemsError;

      // Update PO items with received quantities
      for (const item of data.items) {
        // Get current quantity received
        const { data: currentItem, error: fetchError } = await supabase
          .from('po_items')
          .select('quantity_received')
          .eq('id', item.po_item_id)
          .single();

        if (fetchError) throw fetchError;

        const { error: updateError } = await supabase
          .from('po_items')
          .update({ 
            quantity_received: currentItem.quantity_received + item.quantity_received
          })
          .eq('id', item.po_item_id);

        if (updateError) throw updateError;
      }

      return receipt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({
        title: "Success",
        description: "Goods receipt created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create goods receipt",
        variant: "destructive",
      });
      console.error('Create receipt error:', error);
    },
  });
}

// Get PO summary stats
export function usePoSummaryStats() {
  return useQuery({
    queryKey: ['po-summary-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('status, final_amount');

      if (error) throw error;

      const summary: PoSummary = {
        total_pos: data.length,
        draft_pos: data.filter(po => po.status === 'draft').length,
        sent_pos: data.filter(po => po.status === 'sent').length,
        completed_pos: data.filter(po => po.status === 'completed').length,
        pending_deliveries: data.filter(po => ['sent', 'acknowledged', 'partially_received'].includes(po.status)).length,
        total_value: data.reduce((sum, po) => sum + (po.final_amount || 0), 0),
      };

      return summary;
    },
  });
}