import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/currentUser";
import { toast } from "sonner";
import type { BlanketPoRelease, CreateBpoReleaseData, BpoReleaseStatus } from "@/types/blanketPurchaseOrder";

export function useBpoReleases(bpoId: string) {
  return useQuery({
    queryKey: ['bpo-releases', bpoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blanket_po_releases')
        .select(`
          *,
          items:blanket_po_release_items(
            *,
            bpo_item:blanket_po_items(item_name, item_code, unit_of_measure)
          ),
          requested_by_profile:profiles!blanket_po_releases_requested_by_fkey(full_name, email),
          approved_by_profile:profiles!blanket_po_releases_approved_by_fkey(full_name, email)
        `)
        .eq('bpo_id', bpoId)
        .order('release_date', { ascending: false });

      if (error) throw error;
      return data as BlanketPoRelease[];
    },
    enabled: !!bpoId,
  });
}

export function useBpoRelease(id: string) {
  return useQuery({
    queryKey: ['bpo-release', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blanket_po_releases')
        .select(`
          *,
          items:blanket_po_release_items(
            *,
            bpo_item:blanket_po_items(item_name, item_code, unit_of_measure)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as BlanketPoRelease;
    },
    enabled: !!id,
  });
}

export function useCreateBpoRelease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBpoReleaseData) => {
      const user = getCachedUser();
      if (!user) throw new Error("Not authenticated");

      const { items, ...releaseData } = data;

      const { data: release, error: releaseError } = await supabase
        .from('blanket_po_releases')
        .insert({
          ...releaseData,
          requested_by: user.id,
        } as any)
        .select()
        .single();

      if (releaseError) throw releaseError;

      const releaseItems = await Promise.all(
        items.map(async (item) => {
          const { data: bpoItem } = await supabase
            .from('blanket_po_items')
            .select('unit_price')
            .eq('id', item.bpo_item_id)
            .single();

          return {
            release_id: release.id,
            bpo_item_id: item.bpo_item_id,
            quantity_requested: item.quantity_requested,
            quantity_approved: item.quantity_requested,
            unit_price: bpoItem?.unit_price || 0,
            total_price: (bpoItem?.unit_price || 0) * item.quantity_requested,
            delivery_date: item.delivery_date,
            delivery_location_id: item.delivery_location_id,
            notes: item.notes,
          };
        })
      );

      const { error: itemsError } = await supabase
        .from('blanket_po_release_items')
        .insert(releaseItems);

      if (itemsError) throw itemsError;

      return release;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bpo-releases', variables.bpo_id] });
      queryClient.invalidateQueries({ queryKey: ['blanket-purchase-order', variables.bpo_id] });
      toast.success("Release created successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to create release: " + error.message);
    },
  });
}

export function useUpdateBpoReleaseStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, bpoId }: { id: string; status: BpoReleaseStatus; bpoId: string }) => {
      const user = getCachedUser();
      if (!user) throw new Error("Not authenticated");

      const updateData: any = { release_status: status };
      
      if (status === 'approved') {
        updateData.approved_by = user.id;
        updateData.approved_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from('blanket_po_releases')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      return { bpoId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bpo-releases'] });
      queryClient.invalidateQueries({ queryKey: ['blanket-purchase-order', data.bpoId] });
      toast.success("Release status updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update release status: " + error.message);
    },
  });
}

export function useReceiveBpoRelease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      releaseId, 
      bpoId,
      items 
    }: { 
      releaseId: string;
      bpoId: string;
      items: { id: string; quantity_received: number }[] 
    }) => {
      for (const item of items) {
        const { error } = await supabase
          .from('blanket_po_release_items')
          .update({ quantity_received: item.quantity_received })
          .eq('id', item.id);

        if (error) throw error;
      }

      const { error: statusError } = await supabase
        .from('blanket_po_releases')
        .update({ 
          release_status: 'received',
          actual_delivery_date: new Date().toISOString(),
        })
        .eq('id', releaseId);

      if (statusError) throw statusError;

      return { bpoId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bpo-releases'] });
      queryClient.invalidateQueries({ queryKey: ['blanket-purchase-order', data.bpoId] });
      toast.success("Release received successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to receive release: " + error.message);
    },
  });
}

export function useDeleteBpoRelease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, bpoId }: { id: string; bpoId: string }) => {
      const { error } = await supabase
        .from('blanket_po_releases')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { bpoId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bpo-releases'] });
      queryClient.invalidateQueries({ queryKey: ['blanket-purchase-order', data.bpoId] });
      toast.success("Release deleted successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete release: " + error.message);
    },
  });
}
