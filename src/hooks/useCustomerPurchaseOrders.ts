import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { CustomerPurchaseOrder, CreateCustomerPoData } from "@/types/customer";
import { toast } from "sonner";
import { untypedRpc } from "@/lib/untypedRpc";

export function useCustomerPurchaseOrders(companyId?: string) {
  const { data: customerPOs = [], isLoading, error } = useQuery({
    queryKey: ['customer-purchase-orders', companyId],
    queryFn: async () => {
      let query = supabase
        .from('customer_purchase_orders')
        .select(`
          *,
          customer:customers(customer_name, customer_code),
          items:customer_po_items(*)
        `)
        .order('created_at', { ascending: false });
      
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as CustomerPurchaseOrder[];
    },
  });

  const queryClient = useQueryClient();

  const createCustomerPO = useMutation({
    mutationFn: async (poData: CreateCustomerPoData) => {
      const user = getCachedUser();
      
      // Create customer PO
      const insertData = {
        customer_id: poData.customer_id,
        company_id: poData.company_id,
        cpo_number: poData.cpo_number || undefined, // Let trigger generate if not provided
        po_date: poData.po_date || new Date().toISOString().split('T')[0],
        delivery_date: poData.delivery_date,
        notes: poData.notes,
        created_by: user?.id
      };
      
      const { data: cpo, error: cpoError } = await supabase
        .from('customer_purchase_orders')
        .insert(insertData as any) // Bypass TypeScript check for auto-generated fields
        .select()
        .single();
      
      if (cpoError) throw cpoError;

      // Create customer PO items
      if (poData.items.length > 0) {
        const { error: itemsError } = await supabase
          .from('customer_po_items')
          .insert(
            poData.items.map(item => ({
              cpo_id: cpo.id,
              finished_good_id: item.finished_good_id,
              item_name: item.item_name,
              description: item.description,
              quantity_ordered: item.quantity_ordered,
              unit_price: item.unit_price,
              total_price: item.total_price,
              delivery_date: item.delivery_date,
              color: item.color,
              size: item.size,
              // Production finds the BOM from the product and style number.
              product_master_id: item.product_master_id || null,
              style_no: item.style_no || null,
              unit_of_measure: (item as { unit_of_measure?: string }).unit_of_measure || 'pcs',
            }))
          );
        
        if (itemsError) throw itemsError;
      }

      return cpo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-purchase-orders'] });
      toast.success("Customer PO created successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to create customer PO: ${error.message}`);
    },
  });

  const updateCustomerPO = useMutation({
    mutationFn: async ({ id, ...updateData }: { id: string } & Partial<CustomerPurchaseOrder>) => {
      const { data, error } = await supabase
        .from('customer_purchase_orders')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-purchase-orders'] });
      toast.success("Customer PO updated successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to update customer PO: ${error.message}`);
    },
  });

  const deleteCustomerPO = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customer_purchase_orders')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-purchase-orders'] });
      toast.success("Customer PO deleted successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete customer PO: ${error.message}`);
    },
  });

  // Decided in the database (decide_customer_po): admins of the company, with history.
  const approveCPO = useMutation({
    mutationFn: ({ id, action, comments }: { id: string; action: 'approved' | 'rejected'; comments?: string }) =>
      untypedRpc<string>('decide_customer_po', { p_cpo_id: id, p_approve: action === 'approved', p_comments: comments || null }),
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['customer-purchase-orders'] });
      toast.success(`Customer PO ${action} successfully`);
    },
    onError: (error: any) => {
      toast.error(`Failed to process approval: ${error.message}`);
    },
  });

  const submitForApproval = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('customer_purchase_orders')
        .update({
          status: 'pending_approval',
          pending_approval: true
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-purchase-orders'] });
      toast.success("Customer PO submitted for approval");
    },
    onError: (error: any) => {
      toast.error(`Failed to submit for approval: ${error.message}`);
    },
  });

  const cancelCPO = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const user = getCachedUser();
      
      const { data, error } = await supabase
        .from('customer_purchase_orders')
        .update({
          status: 'cancelled',
          approval_comments: reason || 'Order cancelled',
          approved_by: user?.id,
          approved_date: new Date().toISOString(),
          pending_approval: false
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-purchase-orders'] });
      toast.success("Customer PO cancelled successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to cancel customer PO: ${error.message}`);
    },
  });

  // Delivered → completed (admins and sales managers; checked in the database).
  const completeCPO = useMutation({
    mutationFn: (id: string) => untypedRpc<null>('complete_customer_po', { p_cpo_id: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['customer-purchase-order'] });
      toast.success("Customer PO completed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    customerPOs,
    isLoading,
    error,
    createCustomerPO,
    completeCPO,
    updateCustomerPO,
    deleteCustomerPO,
    approveCPO,
    submitForApproval,
    cancelCPO,
    isCreating: createCustomerPO.isPending,
    isUpdating: updateCustomerPO.isPending,
    isDeleting: deleteCustomerPO.isPending,
    isApproving: approveCPO.isPending,
    isSubmitting: submitForApproval.isPending,
    isCancelling: cancelCPO.isPending,
    isCompleting: completeCPO.isPending,
  };
}