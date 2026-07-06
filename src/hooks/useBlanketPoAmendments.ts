import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { toast } from "sonner";
import type { BlanketPoAmendment, CreateBpoAmendmentData } from "@/types/blanketPurchaseOrder";

export function useBpoAmendments(bpoId: string) {
  return useQuery({
    queryKey: ['bpo-amendments', bpoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blanket_po_amendments')
        .select(`
          *,
          approver_profile:profiles!blanket_po_amendments_approved_by_fkey(full_name, email)
        `)
        .eq('bpo_id', bpoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BlanketPoAmendment[];
    },
    enabled: !!bpoId,
  });
}

export function useCreateBpoAmendment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBpoAmendmentData) => {
      const user = getCachedUser();
      if (!user) throw new Error("Not authenticated");

      const { data: existingAmendments } = await supabase
        .from('blanket_po_amendments')
        .select('amendment_number')
        .eq('bpo_id', data.bpo_id)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastNumber = existingAmendments && existingAmendments.length > 0
        ? parseInt(existingAmendments[0].amendment_number.split('-').pop() || '0')
        : 0;

      const amendmentNumber = `AMD-${String(lastNumber + 1).padStart(3, '0')}`;

      const { data: amendment, error } = await supabase
        .from('blanket_po_amendments')
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
      queryClient.invalidateQueries({ queryKey: ['bpo-amendments', variables.bpo_id] });
      queryClient.invalidateQueries({ queryKey: ['blanket-purchase-order', variables.bpo_id] });
      toast.success("Amendment created successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to create amendment: " + error.message);
    },
  });
}

export function useApproveAmendment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, bpoId }: { id: string; bpoId: string }) => {
      const user = getCachedUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('blanket_po_amendments')
        .update({
          approved_by: user.id,
          approved_date: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      return { bpoId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bpo-amendments', data.bpoId] });
      queryClient.invalidateQueries({ queryKey: ['blanket-purchase-order', data.bpoId] });
      toast.success("Amendment approved successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to approve amendment: " + error.message);
    },
  });
}
