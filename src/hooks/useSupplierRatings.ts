import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSupplierAnalytics } from './useSupplierAnalytics';
import { toast } from '@/hooks/use-toast';

/**
 * Calculate supplier rating from performance rate
 * Formula: rating = (performanceRate / 100) * 5
 */
export const calculateRatingFromPerformance = (performanceRate: number): number => {
  return Number(((performanceRate / 100) * 5).toFixed(2));
};

/**
 * Hook to update a supplier's rating based on their performance evaluations
 */
export const useUpdateSupplierRating = () => {
  const queryClient = useQueryClient();
  const { data: analytics } = useSupplierAnalytics();

  return useMutation({
    mutationFn: async (supplierId: string) => {
      // Find analytics for this supplier
      const supplierAnalytics = analytics?.find(a => a.supplierId === supplierId);
      
      if (!supplierAnalytics) {
        // No evaluations yet, set rating to null
        const { error } = await supabase
          .from('suppliers')
          .update({ rating: null })
          .eq('id', supplierId);
        
        if (error) throw error;
        return { supplierId, rating: null };
      }

      // Calculate rating from average performance rate
      const rating = calculateRatingFromPerformance(supplierAnalytics.avgPerformanceRate);

      // Update supplier rating
      const { error } = await supabase
        .from('suppliers')
        .update({ rating })
        .eq('id', supplierId);

      if (error) throw error;

      return { supplierId, rating, performanceRate: supplierAnalytics.avgPerformanceRate };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier', data.supplierId] });
      
      if (data.rating !== null) {
        toast({
          title: 'Rating Updated',
          description: `Supplier rating updated to ${data.rating} stars (${data.performanceRate}% performance)`,
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update supplier rating: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};

/**
 * Hook to bulk update all supplier ratings
 */
export const useBulkUpdateSupplierRatings = () => {
  const queryClient = useQueryClient();
  const { data: analytics } = useSupplierAnalytics();

  return useMutation({
    mutationFn: async () => {
      if (!analytics || analytics.length === 0) {
        throw new Error('No analytics data available');
      }

      const updates = analytics.map(async (supplierAnalytics) => {
        const rating = calculateRatingFromPerformance(supplierAnalytics.avgPerformanceRate);
        
        const { error } = await supabase
          .from('suppliers')
          .update({ rating })
          .eq('id', supplierAnalytics.supplierId);

        if (error) throw error;
        return { supplierId: supplierAnalytics.supplierId, rating };
      });

      const results = await Promise.all(updates);
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: 'Bulk Update Complete',
        description: `Successfully updated ratings for ${results.length} suppliers`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Bulk Update Failed',
        description: `Failed to update supplier ratings: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
};
