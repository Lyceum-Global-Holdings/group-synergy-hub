import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MaterialDemand, MaterialDemandItem, CreateMaterialDemandData, DemandCalculationInput, PODemandCalculationInput, CPODemandCalculationInput, DemandAnalysisResult, MRPReport } from '@/types/materialDemand';
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

      // Get warehouse items for stock levels - collect all identifiers for better matching
      const warehouseItemIds = bomItems?.map(item => item.warehouse_item_id).filter(Boolean) || [];
      const itemCodes = bomItems?.map(item => item.item_code).filter(Boolean) || [];
      const itemNames = bomItems?.map(item => item.item_name).filter(Boolean) || [];
      
      let warehouseItems: any[] = [];
      if (warehouseItemIds.length > 0 || itemCodes.length > 0 || itemNames.length > 0) {
        let query = supabase
          .from('warehouse_items')
          .select('id, item_code, name, current_stock, reorder_level, min_stock_level, unit_cost, supplier_id, company_id');
        
        // Add company filter if available
        if (companyId) {
          query = query.eq('company_id', companyId);
        }
        
        // Use OR condition to match by id, item_code, or name
        if (warehouseItemIds.length > 0) {
          query = query.or(`id.in.(${warehouseItemIds.join(',')}),item_code.in.(${itemCodes.join(',')}),name.in.(${itemNames.join(',')})`);
        } else if (itemCodes.length > 0) {
          query = query.or(`item_code.in.(${itemCodes.join(',')}),name.in.(${itemNames.join(',')})`);
        } else {
          query = query.in('name', itemNames);
        }

        const { data: warehouseData, error: warehouseError } = await query;
        if (warehouseError) throw warehouseError;
        warehouseItems = warehouseData || [];
      }

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
      let matchedItems = 0;
      let unmatchedItems = 0;

      for (const bomItem of bomItems || []) {
        // Improved warehouse item matching: id → item_code → name
        const warehouseItem = warehouseItems?.find(w => {
          if (bomItem.warehouse_item_id && w.id === bomItem.warehouse_item_id) return true;
          if (bomItem.item_code && w.item_code === bomItem.item_code) return true;
          if (bomItem.item_name && w.name === bomItem.item_name) return true;
          return false;
        });
        
        if (warehouseItem) {
          matchedItems++;
        } else {
          unmatchedItems++;
          console.log(`No warehouse item found for BOM item: ${bomItem.item_name} (${bomItem.item_code})`);
        }

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
          item_code: bomItem.item_code || '',
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

      console.log(`BOM Demand Calculation: ${matchedItems} matched, ${unmatchedItems} unmatched items`);
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
      console.log('=== Enhanced PO Demand Calculation Started ===');
      console.log('Input:', input);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Validate input
      if (!input.po_ids || input.po_ids.length === 0) {
        throw new Error('No purchase orders selected for analysis');
      }

      const analysisResults: DemandAnalysisResult[] = [];
      
      // Fetch all purchase orders and their items
      const { data: purchaseOrders, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          po_items (*),
          supplier:suppliers (name)
        `)
        .in('id', input.po_ids);

      if (poError) {
        console.error('Error fetching purchase orders:', poError);
        throw new Error('Failed to fetch purchase orders');
      }

      console.log('Fetched purchase orders:', purchaseOrders?.length);

      // Fetch finished goods with their BOMs - matching by product_code
      const { data: finishedGoods, error: fgError } = await supabase
        .from('finished_goods')
        .select(`
          *,
          bill_of_materials (
            id,
            bom_number,
            product_name,
            bom_items (
              id,
              item_name,
              item_code,
              quantity,
              unit_of_measure,
              consumption,
              warehouse_item_id
            )
          )
        `);

      if (fgError) {
        console.error('Error fetching finished goods:', fgError);
        throw new Error('Failed to fetch finished goods');
      }

      console.log('Fetched finished goods:', finishedGoods?.length);

      // Fetch warehouse items for stock information
      const { data: warehouseItems, error: wiError } = await supabase
        .from('warehouse_items')
        .select('*');

      if (wiError) {
        console.error('Error fetching warehouse items:', wiError);
        throw new Error('Failed to fetch warehouse items');
      }

      console.log('Fetched warehouse items:', warehouseItems?.length);

      // Create lookup maps for efficient matching
      const finishedGoodsMap = new Map();
      const warehouseItemsMap = new Map();
      
      finishedGoods?.forEach(fg => {
        if (fg.product_code) {
          finishedGoodsMap.set(fg.product_code, fg);
        }
      });
      
      warehouseItems?.forEach(wi => {
        if (wi.item_code) {
          warehouseItemsMap.set(wi.item_code, wi);
        }
      });

      console.log(`Finished goods mapping: ${finishedGoodsMap.size} items`);
      console.log(`Warehouse items mapping: ${warehouseItemsMap.size} items`);

      // Process each purchase order with enhanced logic
      for (const po of purchaseOrders || []) {
        console.log(`\n--- Processing PO: ${po.po_number} ---`);
        
        for (const poItem of po.po_items || []) {
          console.log(`\nProcessing PO Item: ${poItem.item_name} (Code: ${poItem.item_code})`);
          console.log(`PO Quantity: ${poItem.quantity_ordered}`);
          
          // Step 1: Check if PO item matches a finished good by item_code
          const matchedFinishedGood = finishedGoodsMap.get(poItem.item_code);
          
          if (matchedFinishedGood) {
            console.log(`✓ Matched with finished good: ${matchedFinishedGood.product_name}`);
            console.log(`Current FG Stock: ${matchedFinishedGood.current_stock}`);
            
            // Step 2: Apply the formula - (PO Quantity - Available FG Stock)
            const availableStock = Number(matchedFinishedGood.current_stock) || 0;
            const poQuantity = Number(poItem.quantity_ordered) * (input.multiplier || 1);
            const requiredProduction = Math.max(0, poQuantity - availableStock);
            
            console.log(`Formula: max(0, ${poQuantity} - ${availableStock}) = ${requiredProduction}`);
            
            if (requiredProduction > 0) {
              console.log(`⚡ Production required: ${requiredProduction} units`);
              
              // Step 3: Calculate BOM material requirements ONLY for the shortfall
              if (matchedFinishedGood.bill_of_materials?.bom_items) {
                console.log('📋 Expanding BOM for shortfall quantity...');
                
                for (const bomItem of matchedFinishedGood.bill_of_materials.bom_items) {
                  const consumptionPerUnit = Number(bomItem.consumption) || Number(bomItem.quantity) || 0;
                  const materialRequired = requiredProduction * consumptionPerUnit;
                  
                  const warehouseItem = warehouseItemsMap.get(bomItem.item_code);
                  const currentMaterialStock = Number(warehouseItem?.current_stock) || 0;
                  const materialShortage = Math.max(0, materialRequired - currentMaterialStock);
                  
                  console.log(`  📦 ${bomItem.item_name}:`);
                  console.log(`    Consumption: ${consumptionPerUnit} per unit`);
                  console.log(`    Required: ${materialRequired} (${requiredProduction} × ${consumptionPerUnit})`);
                  console.log(`    Stock: ${currentMaterialStock}`);
                  console.log(`    Shortage: ${materialShortage}`);
                  
                  // Find existing result or create new one
                  let existingResult = analysisResults.find(r => r.item_code === bomItem.item_code);
                  
                  if (existingResult) {
                    existingResult.total_required += materialRequired;
                    existingResult.shortage = Math.max(0, existingResult.total_required - existingResult.available_stock);
                    existingResult.suggested_order = existingResult.shortage;
                  } else {
                    analysisResults.push({
                      item_code: bomItem.item_code || 'N/A',
                      item_name: bomItem.item_name,
                      total_required: materialRequired,
                      available_stock: currentMaterialStock,
                      on_order: 0,
                      shortage: materialShortage,
                      suggested_order: materialShortage,
                      unit_of_measure: bomItem.unit_of_measure,
                      category: 'BOM Material',
                      priority: materialShortage > 0 ? 'high' : 'medium',
                      lead_time_days: 7,
                      is_linked_to_bom: true,
                      bom_info: {
                        bom_number: matchedFinishedGood.bill_of_materials.bom_number,
                        product_name: matchedFinishedGood.bill_of_materials.product_name
                      },
                      finished_good_info: {
                        product_code: matchedFinishedGood.product_code,
                        product_name: matchedFinishedGood.product_name,
                        current_stock: availableStock
                      },
                      po_details: [{
                        po_number: po.po_number,
                        supplier_name: po.supplier?.name || 'Unknown',
                        quantity_ordered: poItem.quantity_ordered,
                        quantity_pending: poItem.quantity_pending || 0,
                        delivery_date: poItem.delivery_date,
                        expected_delivery: po.expected_delivery_date
                      }]
                    });
                  }
                }
              } else {
                console.log('⚠️ No BOM found for finished good');
              }
            } else {
              console.log(`✓ Fully satisfied from stock (${availableStock} >= ${poQuantity})`);
              
              // Add entry to show stock fulfillment
              analysisResults.push({
                item_code: matchedFinishedGood.product_code,
                item_name: matchedFinishedGood.product_name,
                total_required: poQuantity,
                available_stock: availableStock,
                on_order: 0,
                shortage: 0,
                suggested_order: 0,
                unit_of_measure: matchedFinishedGood.unit_of_measure,
                category: 'Fulfilled from Stock',
                priority: 'low',
                lead_time_days: 0,
                finished_good_info: {
                  product_code: matchedFinishedGood.product_code,
                  product_name: matchedFinishedGood.product_name,
                  current_stock: availableStock
                },
                po_details: [{
                  po_number: po.po_number,
                  supplier_name: po.supplier?.name || 'Unknown',
                  quantity_ordered: poItem.quantity_ordered,
                  quantity_pending: poItem.quantity_pending || 0,
                  delivery_date: poItem.delivery_date,
                  expected_delivery: po.expected_delivery_date
                }]
              });
            }
          } else {
            console.log('❌ No finished good match - treating as direct raw material purchase');
            
            // Direct raw material purchase - no BOM expansion needed
            const warehouseItem = warehouseItemsMap.get(poItem.item_code);
            const currentStock = Number(warehouseItem?.current_stock) || 0;
            const poQuantityWithMultiplier = Number(poItem.quantity_ordered) * (input.multiplier || 1);
            const shortage = Math.max(0, poQuantityWithMultiplier - currentStock);
            
            console.log(`  Direct material: ${poItem.item_name}`);
            console.log(`  Required: ${poQuantityWithMultiplier}, Stock: ${currentStock}, Shortage: ${shortage}`);
            
            analysisResults.push({
              item_code: poItem.item_code || 'N/A',
              item_name: poItem.item_name,
              total_required: poQuantityWithMultiplier,
              available_stock: currentStock,
              on_order: 0,
              shortage: shortage,
              suggested_order: shortage,
              unit_of_measure: poItem.unit_of_measure,
              category: 'Direct Purchase',
              priority: shortage > 0 ? 'medium' : 'low',
              lead_time_days: 7,
              po_details: [{
                po_number: po.po_number,
                supplier_name: po.supplier?.name || 'Unknown',
                quantity_ordered: poItem.quantity_ordered,
                quantity_pending: poItem.quantity_pending || 0,
                delivery_date: poItem.delivery_date,
                expected_delivery: po.expected_delivery_date
              }]
            });
          }
        }
      }

      console.log(`\n=== Enhanced PO Demand Calculation Complete ===`);
      console.log(`Total material demands identified: ${analysisResults.length}`);
      console.log('Categories:', analysisResults.reduce((acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>));
      
      return analysisResults;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "PO material demand calculated successfully",
      });
    },
    onError: (error) => {
      console.error('Error calculating PO demand:', error);
      toast({
        title: "Error",
        description: `Failed to calculate PO demand: ${error.message}`,
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

  const calculateCPODemandMutation = useMutation({
    mutationFn: async (input: CPODemandCalculationInput): Promise<DemandAnalysisResult[]> => {
      console.log('=== CPO Demand Calculation Started ===');
      console.log('Input:', input);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Validate input
      if (!input.cpo_ids || input.cpo_ids.length === 0) {
        throw new Error('No customer purchase orders selected for analysis');
      }

      const analysisResults: DemandAnalysisResult[] = [];
      
      // Fetch customer purchase orders and their items
      const { data: customerPOs, error: cpoError } = await supabase
        .from('customer_purchase_orders')
        .select(`
          *,
          customer:customers(customer_name, customer_code),
          items:customer_po_items(*)
        `)
        .in('id', input.cpo_ids);

      if (cpoError) {
        console.error('Error fetching customer purchase orders:', cpoError);
        throw new Error('Failed to fetch customer purchase orders');
      }

      console.log('Fetched customer POs:', customerPOs?.length);

      // Fetch finished goods with their BOMs
      const { data: finishedGoods, error: fgError } = await supabase
        .from('finished_goods')
        .select(`
          *,
          bill_of_materials (
            id,
            bom_number,
            product_name,
            bom_items (
              id,
              item_name,
              item_code,
              quantity,
              unit_of_measure,
              consumption,
              warehouse_item_id
            )
          )
        `);

      if (fgError) {
        console.error('Error fetching finished goods:', fgError);
        throw new Error('Failed to fetch finished goods');
      }

      // Fetch warehouse items for stock information
      const { data: warehouseItems, error: wiError } = await supabase
        .from('warehouse_items')
        .select('*');

      if (wiError) {
        console.error('Error fetching warehouse items:', wiError);
        throw new Error('Failed to fetch warehouse items');
      }

      // Create lookup maps for efficient matching
      const finishedGoodsMap = new Map();
      const warehouseItemsMap = new Map();
      
      finishedGoods?.forEach(fg => {
        if (fg.id) {
          finishedGoodsMap.set(fg.id, fg);
        }
      });
      
      warehouseItems?.forEach(wi => {
        if (wi.item_code) {
          warehouseItemsMap.set(wi.item_code, wi);
        }
      });

      // Process each customer purchase order
      for (const cpo of customerPOs || []) {
        console.log(`\n--- Processing CPO: ${cpo.cpo_number} ---`);
        
        for (const cpoItem of cpo.items || []) {
          console.log(`\nProcessing CPO Item: ${cpoItem.item_name}`);
          console.log(`CPO Quantity: ${cpoItem.quantity_ordered}`);
          
          // Step 1: Check if CPO item matches a finished good by finished_good_id
          const matchedFinishedGood = finishedGoodsMap.get(cpoItem.finished_good_id);
          
          if (matchedFinishedGood) {
            console.log(`✓ Matched with finished good: ${matchedFinishedGood.product_name}`);
            console.log(`Current FG Stock: ${matchedFinishedGood.current_stock}`);
            
            // Step 2: Apply the formula - (CPO Quantity - Available FG Stock)
            const availableStock = Number(matchedFinishedGood.current_stock) || 0;
            const cpoQuantity = Number(cpoItem.quantity_ordered) * (input.multiplier || 1);
            const requiredProduction = Math.max(0, cpoQuantity - availableStock);
            
            console.log(`Formula: max(0, ${cpoQuantity} - ${availableStock}) = ${requiredProduction}`);
            
            if (requiredProduction > 0) {
              console.log(`⚡ Production required: ${requiredProduction} units`);
              
              // Step 3: Calculate BOM material requirements ONLY for the shortfall
              if (matchedFinishedGood.bill_of_materials?.bom_items) {
                console.log('📋 Expanding BOM for shortfall quantity...');
                
                for (const bomItem of matchedFinishedGood.bill_of_materials.bom_items) {
                  const consumptionPerUnit = Number(bomItem.consumption) || Number(bomItem.quantity) || 0;
                  const materialRequired = requiredProduction * consumptionPerUnit;
                  
                  const warehouseItem = warehouseItemsMap.get(bomItem.item_code);
                  const currentMaterialStock = Number(warehouseItem?.current_stock) || 0;
                  const materialShortage = Math.max(0, materialRequired - currentMaterialStock);
                  
                  console.log(`  📦 ${bomItem.item_name}:`);
                  console.log(`    Consumption: ${consumptionPerUnit} per unit`);
                  console.log(`    Required: ${materialRequired} (${requiredProduction} × ${consumptionPerUnit})`);
                  console.log(`    Stock: ${currentMaterialStock}`);
                  console.log(`    Shortage: ${materialShortage}`);
                  
                  // Find existing result or create new one
                  let existingResult = analysisResults.find(r => r.item_code === bomItem.item_code);
                  
                  if (existingResult) {
                    existingResult.total_required += materialRequired;
                    existingResult.shortage = Math.max(0, existingResult.total_required - existingResult.available_stock);
                    existingResult.suggested_order = existingResult.shortage;
                  } else {
                    analysisResults.push({
                      item_code: bomItem.item_code || 'N/A',
                      item_name: bomItem.item_name,
                      total_required: materialRequired,
                      available_stock: currentMaterialStock,
                      on_order: 0,
                      shortage: materialShortage,
                      suggested_order: materialShortage,
                      unit_of_measure: bomItem.unit_of_measure,
                      category: 'BOM Material',
                      priority: materialShortage > 0 ? 'high' : 'medium',
                      lead_time_days: 7,
                      is_linked_to_bom: true,
                      bom_info: {
                        bom_number: matchedFinishedGood.bill_of_materials.bom_number,
                        product_name: matchedFinishedGood.bill_of_materials.product_name
                      },
                      finished_good_info: {
                        product_code: matchedFinishedGood.product_code,
                        product_name: matchedFinishedGood.product_name,
                        current_stock: matchedFinishedGood.current_stock
                      }
                    });
                  }
                }
              }
            } else {
              console.log('✅ Can be fulfilled from existing finished goods stock');
              
              // Add entry for fulfilled from stock
              analysisResults.push({
                item_code: matchedFinishedGood.product_code || 'N/A',
                item_name: cpoItem.item_name,
                total_required: cpoQuantity,
                available_stock: availableStock,
                on_order: 0,
                shortage: 0,
                suggested_order: 0,
                unit_of_measure: 'pcs',
                category: 'Fulfilled from Stock',
                priority: 'low',
                lead_time_days: 0,
                finished_good_info: {
                  product_code: matchedFinishedGood.product_code,
                  product_name: matchedFinishedGood.product_name,
                  current_stock: matchedFinishedGood.current_stock
                }
              });
            }
          } else {
            console.log('❌ No finished good found for CPO item');
            
            // Add entry for unmatched item
            analysisResults.push({
              item_code: 'UNMATCHED',
              item_name: cpoItem.item_name,
              total_required: Number(cpoItem.quantity_ordered) * (input.multiplier || 1),
              available_stock: 0,
              on_order: 0,
              shortage: Number(cpoItem.quantity_ordered) * (input.multiplier || 1),
              suggested_order: Number(cpoItem.quantity_ordered) * (input.multiplier || 1),
              unit_of_measure: 'pcs',
              category: 'No BOM Found',
              priority: 'urgent',
              lead_time_days: 14
            });
          }
        }
      }

      console.log(`=== CPO Demand Calculation Complete ===`);
      console.log(`Total analysis results: ${analysisResults.length}`);
      console.log(`Items requiring production: ${analysisResults.filter(r => r.category === 'BOM Material' && r.shortage > 0).length}`);
      console.log(`Items fulfilled from stock: ${analysisResults.filter(r => r.category === 'Fulfilled from Stock').length}`);

      return analysisResults;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Customer PO material demand calculated successfully",
      });
    },
    onError: (error) => {
      console.error('Error calculating CPO material demand:', error);
      toast({
        title: "Error",
        description: "Failed to calculate customer PO material demand",
        variant: "destructive",
      });
    }
  });

  return {
    calculateBOMDemand: calculateBOMDemandMutation.mutate,
    calculatePODemand: calculatePODemandMutation.mutate,
    calculateCPODemand: calculateCPODemandMutation.mutate,
    generateMRPReport: generateMRPReportMutation.mutate,
    isCalculating: calculateBOMDemandMutation.isPending || calculatePODemandMutation.isPending || calculateCPODemandMutation.isPending,
    calculationResult: calculateBOMDemandMutation.data || calculatePODemandMutation.data || calculateCPODemandMutation.data,
    isGeneratingReport: generateMRPReportMutation.isPending,
    mrpReport: generateMRPReportMutation.data,
  };
};