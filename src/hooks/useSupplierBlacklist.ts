import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { SupplierBlacklist, CreateBlacklistData, UpdateBlacklistData } from "@/types/supplierRisk";

export const useSupplierBlacklist = (supplierId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all blacklist entries or filter by supplier
  const { data: blacklistEntries, isLoading, error } = useQuery({
    queryKey: ['supplier-blacklist', supplierId],
    queryFn: async () => {
      let query = supabase
        .from('supplier_blacklist')
        .select('*, suppliers(name, supplier_code)')
        .order('blacklisted_date', { ascending: false });

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as SupplierBlacklist[];
    },
  });

  // Create blacklist entry
  const createBlacklist = useMutation({
    mutationFn: async (blacklistData: CreateBlacklistData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('supplier_blacklist')
        .insert({
          ...blacklistData,
          blacklisted_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-blacklist'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: "Supplier blacklisted",
        description: "The supplier has been added to the blacklist.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error blacklisting supplier",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update blacklist entry
  const updateBlacklist = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateBlacklistData & { id: string }) => {
      const { data, error } = await supabase
        .from('supplier_blacklist')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-blacklist'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: "Blacklist updated",
        description: "The blacklist entry has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating blacklist",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Clear supplier from blacklist
  const clearBlacklist = useMutation({
    mutationFn: async ({ id, clearing_reason }: { id: string; clearing_reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('supplier_blacklist')
        .update({
          status: 'cleared',
          cleared_date: new Date().toISOString().split('T')[0],
          cleared_by: user.id,
          clearing_reason,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-blacklist'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: "Supplier cleared",
        description: "The supplier has been cleared from the blacklist.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error clearing supplier",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Move to watchlist
  const moveToWatchlist = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('supplier_blacklist')
        .update({ status: 'watchlist' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-blacklist'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: "Moved to watchlist",
        description: "The supplier has been moved to the watchlist.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error moving to watchlist",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete blacklist entry
  const deleteBlacklist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('supplier_blacklist')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-blacklist'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: "Blacklist entry deleted",
        description: "The blacklist entry has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting blacklist entry",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    blacklistEntries,
    isLoading,
    error,
    createBlacklist,
    updateBlacklist,
    clearBlacklist,
    moveToWatchlist,
    deleteBlacklist,
  };
};

// Hook to check if a supplier is blacklisted
export const useIsSupplierBlacklisted = (supplierId: string) => {
  return useQuery({
    queryKey: ['supplier-blacklist-status', supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_blacklist')
        .select('status')
        .eq('supplier_id', supplierId)
        .maybeSingle();

      if (error) throw error;
      return data?.status === 'blacklisted';
    },
    enabled: !!supplierId,
  });
};
