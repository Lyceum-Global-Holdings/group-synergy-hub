import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ProductMaster } from './useProductMaster';
import { CreateFinishedGoodData } from './useFinishedGoods';

export interface BulkGenerateVariantsData {
  productMaster: ProductMaster;
  selectedSizes: string[];
  selectedColors: any[];
  defaultValues: {
    selling_price?: number;
    standard_cost?: number;
    minimum_stock?: number;
    maximum_stock?: number;
    reorder_point?: number;
    lead_time_days?: number;
    quality_status: string;
    status: string;
  };
  duplicateMode: 'skip' | 'update';
}

export interface BulkGenerateResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  total: number;
}

export function useBulkGenerateVariants() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateVariantsMutation = useMutation({
    mutationFn: async (data: BulkGenerateVariantsData): Promise<BulkGenerateResult> => {
      const { productMaster, selectedSizes, selectedColors, defaultValues, duplicateMode } = data;
      
      // Generate all combinations
      const variants: CreateFinishedGoodData[] = [];
      
      for (const size of selectedSizes) {
        for (const color of selectedColors) {
          const colorName = color.name?.replace(/\s+/g, '').toUpperCase() || 'COL';
          const sizeCode = size === 'All' ? '' : `-${size}`;
          const colorSuffix = colorName ? `-${colorName}` : '';
          
          const productCode = `${productMaster.product_code}${sizeCode}${colorSuffix}`;
          const productName = `${productMaster.product_name} - ${size}${color.name ? ` - ${color.name}` : ''}`;
          
          variants.push({
            product_name: productName,
            product_code: productCode,
            style_no: productMaster.style_no || undefined,
            category: productMaster.category_id || undefined,
            description: productMaster.description || undefined,
            size: size,
            color: color.name || '',
            unit_of_measure: productMaster.unit_of_measure,
            product_master_id: productMaster.id,
            company_id: productMaster.company_id || undefined,
            ...defaultValues,
          });
        }
      }

      const result: BulkGenerateResult = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [],
        total: variants.length,
      };

      // Check for existing product codes
      const productCodes = variants.map(v => v.product_code);
      const { data: existingProducts } = await supabase
        .from('finished_goods')
        .select('product_code')
        .in('product_code', productCodes);

      const existingCodes = new Set(existingProducts?.map(p => p.product_code) || []);

      // Get current user
      const { data: user } = await supabase.auth.getUser();

      // Process in chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < variants.length; i += chunkSize) {
        const chunk = variants.slice(i, i + chunkSize);
        
        const toCreate = chunk.filter(v => !existingCodes.has(v.product_code));
        const toUpdate = chunk.filter(v => existingCodes.has(v.product_code));

        // Create new variants
        if (toCreate.length > 0) {
          const { data: created, error: createError } = await supabase
            .from('finished_goods')
            .insert(
              toCreate.map(v => ({
                ...v,
                created_by: user.user?.id,
              }))
            )
            .select();

          if (createError) {
            result.errors.push(`Create error: ${createError.message}`);
          } else {
            result.created += created?.length || 0;
          }
        }

        // Update existing variants if mode is 'update'
        if (duplicateMode === 'update' && toUpdate.length > 0) {
          for (const variant of toUpdate) {
            const { error: updateError } = await supabase
              .from('finished_goods')
              .update({
                product_name: variant.product_name,
                size: variant.size,
                color: variant.color,
                ...defaultValues,
              })
              .eq('product_code', variant.product_code);

            if (updateError) {
              result.errors.push(`Update error for ${variant.product_code}: ${updateError.message}`);
            } else {
              result.updated++;
            }
          }
        } else if (duplicateMode === 'skip' && toUpdate.length > 0) {
          result.skipped += toUpdate.length;
        }
      }

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['finished-goods'] });
      
      let description = '';
      if (result.created > 0) description += `Created: ${result.created}. `;
      if (result.updated > 0) description += `Updated: ${result.updated}. `;
      if (result.skipped > 0) description += `Skipped: ${result.skipped}. `;
      if (result.errors.length > 0) description += `Errors: ${result.errors.length}.`;

      toast({
        title: "Variants Generated",
        description: description || "All variants processed successfully",
      });
    },
    onError: (error: any) => {
      console.error('Error generating variants:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate variants",
        variant: "destructive",
      });
    },
  });

  return {
    generateVariants: generateVariantsMutation.mutate,
    isGenerating: generateVariantsMutation.isPending,
  };
}
