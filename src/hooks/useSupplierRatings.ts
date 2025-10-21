import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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

  return useMutation({
    mutationFn: async (supplierId: string) => {
      // Fetch evaluations for this supplier directly from database
      const { data: evaluations, error: evalError } = await supabase
        .from('supplier_evaluations')
        .select('performance_rate')
        .eq('supplier_id', supplierId);
      
      if (evalError) throw evalError;
      
      // If no evaluations, set rating to null
      if (!evaluations || evaluations.length === 0) {
        const { error } = await supabase
          .from('suppliers')
          .update({ rating: null })
          .eq('id', supplierId);
        
        if (error) throw error;
        return { supplierId, rating: null };
      }
      
      // Calculate average performance rate
      const avgPerformanceRate = evaluations.reduce((sum, e) => sum + e.performance_rate, 0) / evaluations.length;
      
      // Calculate rating from average performance rate
      const rating = calculateRatingFromPerformance(avgPerformanceRate);

      // Update supplier rating
      const { error } = await supabase
        .from('suppliers')
        .update({ rating })
        .eq('id', supplierId);

      if (error) throw error;

      return { supplierId, rating, performanceRate: avgPerformanceRate };
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

  return useMutation({
    mutationFn: async () => {
      // Fetch all evaluations grouped by supplier
      const { data: evaluations, error: evalError } = await supabase
        .from('supplier_evaluations')
        .select('supplier_id, performance_rate');
      
      if (evalError) throw evalError;
      
      if (!evaluations || evaluations.length === 0) {
        throw new Error('No evaluation data available');
      }

      // Group evaluations by supplier_id and calculate average performance rate
      const supplierPerformance = evaluations.reduce((acc, evaluation) => {
        if (!acc[evaluation.supplier_id]) {
          acc[evaluation.supplier_id] = { total: 0, count: 0 };
        }
        acc[evaluation.supplier_id].total += evaluation.performance_rate;
        acc[evaluation.supplier_id].count += 1;
        return acc;
      }, {} as Record<string, { total: number; count: number }>);

      // Update ratings for all suppliers with evaluations
      const updates = Object.entries(supplierPerformance).map(async ([supplierId, data]) => {
        const avgPerformanceRate = data.total / data.count;
        const rating = calculateRatingFromPerformance(avgPerformanceRate);
        
        const { error } = await supabase
          .from('suppliers')
          .update({ rating })
          .eq('id', supplierId);

        if (error) throw error;
        return { supplierId, rating, performanceRate: avgPerformanceRate };
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
