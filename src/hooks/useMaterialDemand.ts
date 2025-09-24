import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MaterialDemand, MaterialDemandItem, CreateMaterialDemandData, DemandCalculationInput, PODemandCalculationInput, DemandAnalysisResult, MRPReport } from '@/types/materialDemand';
import { useToast } from '@/hooks/use-toast';

export const useMaterialDemand = (companyId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: demands = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['material-demand', companyId],
    queryFn: async () => {
      let query = supabase
        .from('material_demand')
        .select('*')
        .order('demand_date', { ascending: true });
      
      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MaterialDemand[];
    }
  });

  const createDemandMutation = useMutation({
    mutationFn: async (demandData: CreateMaterialDemandData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Calculate net requirement
      const currentStock = demandData.current_stock || 0;
      const onOrder = demandData.on_order_quantity || 0;
      const netRequirement = Math.max(0, demandData.gross_requirement - currentStock - onOrder);
      const safetyStock = demandData.safety_stock || 0;
      const suggestedOrder = netRequirement > 0 ? netRequirement + safetyStock : 0;

      const { data, error } = await supabase
        .from('material_demand')
        .insert({
          ...demandData,
          net_requirement: netRequirement,
          suggested_order_quantity: suggestedOrder,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-demand'] });
      toast({
        title: "Success",
        description: "Material demand record created successfully",
      });
    },
    onError: (error) => {
      console.error('Error creating material demand:', error);
      toast({
        title: "Error",
        description: "Failed to create material demand record",
        variant: "destructive",
      });
    }
  });

  const updateDemandMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: Partial<MaterialDemand> & { id: string }) => {
      const { data, error } = await supabase
        .from('material_demand')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-demand'] });
      toast({
        title: "Success",
        description: "Material demand updated successfully",
      });
    },
    onError: (error) => {
      console.error('Error updating material demand:', error);
      toast({
        title: "Error",
        description: "Failed to update material demand",
        variant: "destructive",
      });
    }
  });

  const deleteDemandMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('material_demand')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-demand'] });
      toast({
        title: "Success",
        description: "Material demand deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Error deleting material demand:', error);
      toast({
        title: "Error",
        description: "Failed to delete material demand",
        variant: "destructive",
      });
    }
  });

  return {
    demands,
    isLoading,
    error,
    createDemand: createDemandMutation.mutate,
    updateDemand: updateDemandMutation.mutate,
    deleteDemand: deleteDemandMutation.mutate,
    isCreating: createDemandMutation.isPending,
    isUpdating: updateDemandMutation.isPending,
    isDeleting: deleteDemandMutation.isPending,
  };
};

export const useDemandCalculation = (companyId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const calculateBOMDemandMutation = useMutation({
    mutationFn: async (input: DemandCalculationInput): Promise<DemandAnalysisResult[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get BOM items
      const { data: bomItems, error: bomError } = await supabase
        .from('bom_items')
        .select(`
          *,
          bom:bill_of_materials(product_name)
        `)
        .eq('bom_id', input.bom_id);

      if (bomError) throw bomError;

      // Get warehouse items for stock levels
      const itemCodes = bomItems?.map(item => item.item_code).filter(Boolean) || [];
      const { data: warehouseItems, error: warehouseError } = await supabase
        .from('warehouse_items')
        .select('item_code, current_stock, reorder_level, min_stock_level, unit_cost, supplier_id')
        .in('item_code', itemCodes);

      if (warehouseError) throw warehouseError;

      // Get on-order quantities from PO items
      const { data: poItems, error: poError } = await supabase
        .from('po_items')
        .select(`
          item_code, 
          quantity_pending,
          quantity_ordered,
          delivery_date,
          po:purchase_orders(status, expected_delivery_date, po_number, supplier:suppliers(name))
        `)
        .in('item_code', itemCodes)
        .in('po.status', ['sent', 'acknowledged', 'partially_received']);

      if (poError) throw poError;

      // Group PO items by item_code for better matching
      const poItemsByCode = poItems?.reduce((acc, item) => {
        if (!item.item_code) return acc;
        if (!acc[item.item_code]) acc[item.item_code] = [];
        acc[item.item_code].push(item);
        return acc;
      }, {} as Record<string, any[]>) || {};

      // Calculate demand analysis
      const analysis: DemandAnalysisResult[] = [];

      for (const bomItem of bomItems || []) {
        if (!bomItem.item_code) continue;

        const warehouseItem = warehouseItems?.find(w => w.item_code === bomItem.item_code);
        const relatedPOItems = poItemsByCode[bomItem.item_code] || [];
        
        const totalRequired = (bomItem.consumption || bomItem.quantity || 0) * input.production_quantity;
        const availableStock = warehouseItem?.current_stock || 0;
        const onOrder = relatedPOItems.reduce((sum, item) => sum + (item.quantity_pending || 0), 0);
        const shortage = Math.max(0, totalRequired - availableStock - onOrder);
        const safetyStock = input.include_safety_stock ? (warehouseItem?.min_stock_level || 0) : 0;
        const suggestedOrder = shortage > 0 ? shortage + safetyStock : 0;

        // Determine priority based on shortage and lead time
        let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
        if (shortage > totalRequired * 0.8) priority = 'urgent';
        else if (shortage > totalRequired * 0.5) priority = 'high';
        else if (shortage > 0) priority = 'medium';
        else priority = 'low';

        // Get PO information for this item
        const poInfo = relatedPOItems.map(item => ({
          po_number: item.po?.po_number,
          supplier_name: item.po?.supplier?.name,
          quantity_ordered: item.quantity_ordered,
          quantity_pending: item.quantity_pending,
          delivery_date: item.delivery_date,
          expected_delivery: item.po?.expected_delivery_date
        }));

        analysis.push({
          item_code: bomItem.item_code,
          item_name: bomItem.item_name,
          total_required: totalRequired,
          available_stock: availableStock,
          on_order: onOrder,
          shortage,
          suggested_order: suggestedOrder,
          unit_of_measure: bomItem.unit_of_measure,
          category: bomItem.category,
          priority,
          lead_time_days: 7, // Default lead time
          supplier_info: warehouseItem?.supplier_id ? {
            supplier_id: warehouseItem.supplier_id,
            supplier_name: '', // Would need to join suppliers table
            last_unit_cost: warehouseItem.unit_cost
          } : undefined,
          po_details: poInfo.length > 0 ? poInfo : undefined
        });
      }

      return analysis;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Material demand calculated successfully",
      });
    },
    onError: (error) => {
      console.error('Error calculating material demand:', error);
      toast({
        title: "Error",
        description: "Failed to calculate material demand",
        variant: "destructive",
      });
    }
  });

  const calculatePODemandMutation = useMutation({
    mutationFn: async (input: PODemandCalculationInput): Promise<DemandAnalysisResult[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get PO data with items
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          supplier_id,
          status,
          expected_delivery_date,
          po_items (
            id,
            item_name,
            item_code,
            quantity_ordered,
            quantity_received,
            unit_of_measure,
            warehouse_item_id
          ),
          supplier:suppliers (
            name
          )
        `)
        .in('id', input.po_ids)
        .eq('status', 'approved');

      if (poError) throw poError;

      const analysisResults: DemandAnalysisResult[] = [];
      const itemMap = new Map();

      // Process all PO items
      for (const po of poData) {
        for (const item of po.po_items) {
          const key = item.warehouse_item_id || item.item_code;
          if (!itemMap.has(key)) {
            itemMap.set(key, {
              item_code: item.item_code || '',
              item_name: item.item_name,
              total_required: 0,
              on_order: 0,
              unit_of_measure: item.unit_of_measure,
              po_details: []
            });
          }

          const existingItem = itemMap.get(key);
          const pendingQuantity = (item.quantity_ordered - (item.quantity_received || 0)) * (input.multiplier || 1);
          
          existingItem.total_required += item.quantity_ordered * (input.multiplier || 1);
          existingItem.on_order += pendingQuantity;
          existingItem.po_details.push({
            po_number: po.po_number,
            supplier_name: po.supplier?.name || '',
            quantity_ordered: item.quantity_ordered * (input.multiplier || 1),
            quantity_pending: pendingQuantity,
            expected_delivery: po.expected_delivery_date
          });
        }
      }

      // Get current stock levels and calculate analysis
      for (const [key, itemData] of itemMap.entries()) {
        let currentStock = 0;
        
        if (itemData.item_code) {
          const { data: stockData } = await supabase
            .from('warehouse_items')
            .select('current_stock')
            .eq('item_code', itemData.item_code)
            .single();
          
          currentStock = stockData?.current_stock || 0;
        }

        const shortage = Math.max(0, itemData.total_required - currentStock - itemData.on_order);
        const suggestedOrder = shortage > 0 ? shortage : 0;

        analysisResults.push({
          ...itemData,
          available_stock: currentStock,
          shortage,
          suggested_order: suggestedOrder,
          priority: shortage > 0 ? (shortage > itemData.total_required * 0.5 ? 'high' : 'medium') : 'low',
          lead_time_days: 7 // Default lead time
        });
      }

      // Create demand records
      const demandRecords = analysisResults.map(result => ({
        item_code: result.item_code,
        item_name: result.item_name,
        gross_requirement: result.total_required,
        current_stock: result.available_stock,
        on_order_quantity: result.on_order,
        net_requirement: result.shortage,
        suggested_order_quantity: result.suggested_order,
        demand_date: input.analysis_date,
        demand_source: 'purchase_order' as const,
        reference_id: input.po_ids[0], // Use first PO as reference
        status: 'calculated' as const,
        company_id: companyId
      }));

      const { error: insertError } = await supabase
        .from('material_demand')
        .insert(demandRecords);

      if (insertError) throw insertError;

      return analysisResults;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "PO demand calculated successfully",
      });
    },
    onError: (error) => {
      console.error('Error calculating PO demand:', error);
      toast({
        title: "Error",
        description: "Failed to calculate PO demand",
        variant: "destructive",
      });
    }
  });

  const generateMRPReportMutation = useMutation({
    mutationFn: async (bomIds: string[]): Promise<MRPReport> => {
      // This would generate a comprehensive MRP report
      // For now, return a basic structure
      const report: MRPReport = {
        analysis_date: new Date().toISOString(),
        production_requirements: [],
        material_analysis: [],
        summary: {
          total_items_analyzed: 0,
          items_in_shortage: 0,
          items_requiring_orders: 0,
          total_suggested_order_value: 0
        }
      };
      return report;
    }
  });

  return {
    calculateBOMDemand: calculateBOMDemandMutation.mutate,
    calculatePODemand: calculatePODemandMutation.mutate,
    generateMRPReport: generateMRPReportMutation.mutate,
    isCalculating: calculateBOMDemandMutation.isPending || calculatePODemandMutation.isPending,
    calculationResult: calculateBOMDemandMutation.data || calculatePODemandMutation.data,
    isGeneratingReport: generateMRPReportMutation.isPending,
    mrpReport: generateMRPReportMutation.data,
  };
};