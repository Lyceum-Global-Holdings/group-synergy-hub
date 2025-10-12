import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { BlacklistReview, CreateBlacklistReviewData } from "@/types/supplierRisk";

export const useBlacklistReviews = (blacklistId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch reviews
  const { data: reviews, isLoading, error } = useQuery({
    queryKey: ['blacklist-reviews', blacklistId],
    queryFn: async () => {
      let query = supabase
        .from('blacklist_reviews')
        .select('*')
        .order('review_date', { ascending: false });

      if (blacklistId) {
        query = query.eq('blacklist_id', blacklistId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as BlacklistReview[];
    },
    enabled: !!blacklistId,
  });

  // Create review
  const createReview = useMutation({
    mutationFn: async (reviewData: CreateBlacklistReviewData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('blacklist_reviews')
        .insert({
          ...reviewData,
          reviewed_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Update blacklist next review date if provided
      if (reviewData.next_review_date) {
        await supabase
          .from('supplier_blacklist')
          .update({ next_review_date: reviewData.next_review_date })
          .eq('id', reviewData.blacklist_id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blacklist-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-blacklist'] });
      toast({
        title: "Review completed",
        description: "The blacklist review has been recorded.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating review",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    reviews,
    isLoading,
    error,
    createReview,
  };
};

// Hook to get pending reviews (blacklists that need review)
export const usePendingReviews = () => {
  return useQuery({
    queryKey: ['pending-blacklist-reviews'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('supplier_blacklist')
        .select('*, suppliers(name, supplier_code)')
        .eq('review_required', true)
        .lte('next_review_date', today)
        .in('status', ['blacklisted', 'watchlist'])
        .order('next_review_date', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
};
