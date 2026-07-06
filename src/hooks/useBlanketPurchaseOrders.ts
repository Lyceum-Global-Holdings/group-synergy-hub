import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { toast } from "sonner";
import type { 
  BlanketPurchaseOrder, 
  CreateBlanketPoData, 
  BpoSummaryStats,
  BlanketContractStatus 
} from "@/types/blanketPurchaseOrder";

export function useBlanketPurchaseOrders() {
  return useQuery({
    queryKey: ['blanket-purchase-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blanket_purchase_orders')
        .select(`
          *,
          supplier:suppliers(name, email, phone),
          items:blanket_po_items(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BlanketPurchaseOrder[];
    },
  });
}

export function useBlanketPurchaseOrder(id: string) {
  return useQuery({
    queryKey: ['blanket-purchase-order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blanket_purchase_orders')
        .select(`
          *,
          supplier:suppliers(name, email, phone),
          items:blanket_po_items(*),
          releases:blanket_po_releases(
            *,
            items:blanket_po_release_items(
              *,
              bpo_item:blanket_po_items(item_name, item_code, unit_of_measure)
            )
          ),
          amendments:blanket_po_amendments(
            *,
            approver_profile:profiles!blanket_po_amendments_approved_by_fkey(full_name, email)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as BlanketPurchaseOrder;
    },
    enabled: !!id,
  });
}

export function useCreateBlanketPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBlanketPoData) => {
      const user = getCachedUser();
      if (!user) throw new Error("Not authenticated");

      const { items, ...bpoData } = data;

      const { data: bpo, error: bpoError } = await supabase
        .from('blanket_purchase_orders')
        .insert({
          ...bpoData,
          created_by: user.id,
        } as any)
        .select()
        .single();

      if (bpoError) throw bpoError;

      const itemsWithBpoId = items.map(item => ({
        ...item,
        bpo_id: bpo.id,
      }));

      const { error: itemsError } = await supabase
        .from('blanket_po_items')
        .insert(itemsWithBpoId);

      if (itemsError) throw itemsError;

      return bpo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blanket-purchase-orders'] });
      toast.success("Blanket PO created successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to create Blanket PO: " + error.message);
    },
  });
}

export function useUpdateBlanketPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<BlanketPurchaseOrder> & { id: string }) => {
      const { error } = await supabase
        .from('blanket_purchase_orders')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blanket-purchase-orders'] });
      toast.success("Blanket PO updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update Blanket PO: " + error.message);
    },
  });
}

export function useApproveBlanketPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'cancelled' }) => {
      const user = getCachedUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('blanket_purchase_orders')
        .update({
          contract_status: status,
          approved_by: user.id,
          approved_date: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['blanket-purchase-orders'] });
      toast.success(`Blanket PO ${variables.status === 'active' ? 'approved' : 'rejected'} successfully`);
    },
    onError: (error: Error) => {
      toast.error("Failed to update Blanket PO status: " + error.message);
    },
  });
}

export function useUpdateBpoStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BlanketContractStatus }) => {
      const { error } = await supabase
        .from('blanket_purchase_orders')
        .update({ contract_status: status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blanket-purchase-orders'] });
      toast.success("Status updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update status: " + error.message);
    },
  });
}

export function useDeleteBlanketPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('blanket_purchase_orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blanket-purchase-orders'] });
      toast.success("Blanket PO deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete Blanket PO: " + error.message);
    },
  });
}

export function useBpoSummaryStats() {
  return useQuery({
    queryKey: ['bpo-summary-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blanket_purchase_orders')
        .select('contract_status, total_contract_value, remaining_value');

      if (error) throw error;

      const stats: BpoSummaryStats = {
        total_bpos: data.length,
        active_bpos: data.filter(b => b.contract_status === 'active').length,
        draft_bpos: data.filter(b => b.contract_status === 'draft').length,
        expiring_soon: 0,
        total_value: data.reduce((sum, b) => sum + Number(b.total_contract_value), 0),
        total_spent: data.reduce((sum, b) => sum + (Number(b.total_contract_value) - Number(b.remaining_value)), 0),
        average_utilization: 0,
      };

      if (stats.total_value > 0) {
        stats.average_utilization = (stats.total_spent / stats.total_value) * 100;
      }

      return stats;
    },
  });
}

export function useBpoUtilization(id: string) {
  return useQuery({
    queryKey: ['bpo-utilization', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('calculate_bpo_utilization', { p_bpo_id: id });

      if (error) throw error;
      return data as number;
    },
    enabled: !!id,
  });
}
