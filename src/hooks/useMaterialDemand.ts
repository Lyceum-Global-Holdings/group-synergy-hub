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

      // Get PO data with items and their linked BOM items
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

      // Get all PO item IDs to find linked BOM items
      const allPoItemIds = poData.flatMap(po => po.po_items.map(item => item.id));

      // Get BOM items that are linked to these PO items
      const { data: bomItems, error: bomError } = await supabase
        .from('bom_items')
        .select(`
          id,
          bom_id,
          po_item_id,
          item_name,
          item_code,
          quantity,
          consumption,
          unit_of_measure,
          category,
          warehouse_item_id,
          bill_of_materials!inner(
            id,
            bom_number,
            product_name
          )
        `)
        .in('po_item_id', allPoItemIds)
        .not('po_item_id', 'is', null);

      if (bomError) throw bomError;

      // Get warehouse items for stock levels
      const warehouseItemIds = [...new Set(bomItems.map(item => item.warehouse_item_id).filter(Boolean))];
      const { data: warehouseItems, error: warehouseError } = await supabase
        .from('warehouse_items')
        .select('id, item_code, current_stock, min_stock_level, unit_cost')
        .in('id', warehouseItemIds);

      if (warehouseError) throw warehouseError;

      const analysisResults: DemandAnalysisResult[] = [];
      const materialMap = new Map();

      // Process BOM items linked to PO items
      for (const po of poData) {
        for (const poItem of po.po_items) {
          // Find BOM items linked to this PO item
          const linkedBomItems = bomItems.filter(bomItem => bomItem.po_item_id === poItem.id);
          
          if (linkedBomItems.length === 0) {
            // Handle unlinked PO items - treat as direct material requirement
            const key = poItem.warehouse_item_id || poItem.item_code;
            if (!materialMap.has(key)) {
              materialMap.set(key, {
                item_code: poItem.item_code || '',
                item_name: poItem.item_name,
                total_required: 0,
                on_order: 0,
                unit_of_measure: poItem.unit_of_measure,
                category: 'unlinked',
                po_details: [],
                is_linked_to_bom: false
              });
            }

            const material = materialMap.get(key);
            const multipliedQuantity = poItem.quantity_ordered * (input.multiplier || 1);
            const pendingQuantity = (poItem.quantity_ordered - (poItem.quantity_received || 0)) * (input.multiplier || 1);
            
            material.total_required += multipliedQuantity;
            material.on_order += pendingQuantity;
            material.po_details.push({
              po_number: po.po_number,
              supplier_name: po.supplier?.name || '',
              quantity_ordered: multipliedQuantity,
              quantity_pending: pendingQuantity,
              expected_delivery: po.expected_delivery_date
            });
          } else {
            // Process linked BOM items - use BOM consumption ratios
            for (const bomItem of linkedBomItems) {
              const materialKey = bomItem.warehouse_item_id || bomItem.item_code;
              if (!materialMap.has(materialKey)) {
                materialMap.set(materialKey, {
                  item_code: bomItem.item_code || '',
                  item_name: bomItem.item_name,
                  total_required: 0,
                  on_order: 0,
                  unit_of_measure: bomItem.unit_of_measure,
                  category: bomItem.category,
                  po_details: [],
                  is_linked_to_bom: true,
                  bom_info: {
                    bom_number: bomItem.bill_of_materials.bom_number,
                    product_name: bomItem.bill_of_materials.product_name
                  }
                });
              }

              const material = materialMap.get(materialKey);
              
              // Calculate material requirement based on BOM consumption and PO quantity
              const consumptionRatio = bomItem.consumption || bomItem.quantity || 1;
              const poQuantity = poItem.quantity_ordered * (input.multiplier || 1);
              const materialRequired = consumptionRatio * poQuantity;
              
              const pendingPoQuantity = (poItem.quantity_ordered - (poItem.quantity_received || 0)) * (input.multiplier || 1);
              const pendingMaterialRequired = consumptionRatio * pendingPoQuantity;
              
              material.total_required += materialRequired;
              material.on_order += pendingMaterialRequired;
              
              // Add PO details with calculated material quantities
              const existingPoDetail = material.po_details.find(detail => detail.po_number === po.po_number);
              if (existingPoDetail) {
                existingPoDetail.quantity_ordered += materialRequired;
                existingPoDetail.quantity_pending += pendingMaterialRequired;
              } else {
                material.po_details.push({
                  po_number: po.po_number,
                  supplier_name: po.supplier?.name || '',
                  quantity_ordered: materialRequired,
                  quantity_pending: pendingMaterialRequired,
                  expected_delivery: po.expected_delivery_date
                });
              }
            }
          }
        }
      }

      // Calculate analysis for each material
      for (const [key, materialData] of materialMap.entries()) {
        const warehouseItem = warehouseItems?.find(w => 
          w.id === key || w.item_code === materialData.item_code
        );
        
        const currentStock = warehouseItem?.current_stock || 0;
        const safetyStock = input.include_safety_stock ? (warehouseItem?.min_stock_level || 0) : 0;
        const shortage = Math.max(0, materialData.total_required - currentStock - materialData.on_order);
        const suggestedOrder = shortage > 0 ? shortage + safetyStock : 0;

        // Determine priority based on shortage and requirement
        let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
        if (shortage > materialData.total_required * 0.8) priority = 'urgent';
        else if (shortage > materialData.total_required * 0.5) priority = 'high';
        else if (shortage > 0) priority = 'medium';
        else priority = 'low';

        analysisResults.push({
          ...materialData,
          available_stock: currentStock,
          shortage,
          suggested_order: suggestedOrder,
          priority,
          lead_time_days: 7, // Default lead time
          supplier_info: warehouseItem ? {
            supplier_id: '',
            supplier_name: '',
            last_unit_cost: warehouseItem.unit_cost
          } : undefined
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