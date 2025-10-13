import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PoAmendment, CreatePoAmendmentData } from "@/types/purchaseOrder";

export function usePoAmendments(poId: string) {
  return useQuery({
    queryKey: ['po-amendments', poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('po_amendments')
        .select(`
          *,
          approver_profile:profiles!po_amendments_approved_by_fkey(full_name, email)
        `)
        .eq('po_id', poId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PoAmendment[];
    },
    enabled: !!poId,
  });
}

export function useCreatePoAmendment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePoAmendmentData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: existingAmendments } = await supabase
        .from('po_amendments')
        .select('amendment_number')
        .eq('po_id', data.po_id)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastNumber = existingAmendments && existingAmendments.length > 0
        ? parseInt(existingAmendments[0].amendment_number.split('-').pop() || '0')
        : 0;

      const amendmentNumber = `POAMD-${String(lastNumber + 1).padStart(4, '0')}`;

      const { data: amendment, error } = await supabase
        .from('po_amendments')
        .insert({
          ...data,
          amendment_number: amendmentNumber,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return amendment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['po-amendments', variables.po_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', variables.po_id] });
      toast.success("Amendment created successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to create amendment: " + error.message);
    },
  });
}

export function useApprovePoAmendment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, poId }: { id: string; poId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('po_amendments')
        .update({
          approved_by: user.id,
          approved_date: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return { poId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['po-amendments', data.poId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', data.poId] });
      toast.success("Amendment approved successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to approve amendment: " + error.message);
    },
  });
}
