import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MaterialDemand, MaterialDemandItem, CreateMaterialDemandData, DemandCalculationInput, PODemandCalculationInput, CPODemandCalculationInput, DemandAnalysisResult, MRPReport } from '@/types/materialDemand';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

// Extended type for CPO items with new fields
type ExtendedCPOItem = Database['public']['Tables']['customer_po_items']['Row'] & {
  style_no?: string;
  unit_of_measure?: string;
  linked_fg?: {
    style_no?: string;
    size?: string;
    color?: string;
    product_code?: string;
    product_name?: string;
    current_stock?: number;
  };
};

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

  // Caches for multi-level BOM explosion
  const bomByWarehouseItemIdCache = new Map<string, { bom_id: string; bom_number: string; product_name: string }>();
  const bomItemsByBomIdCache = new Map<string, any[]>();

  // Helper function to fetch BOM by warehouse item ID
  const fetchBomByWarehouseItemId = async (warehouseItemId: string) => {
    if (bomByWarehouseItemIdCache.has(warehouseItemId)) {
      return bomByWarehouseItemIdCache.get(warehouseItemId);
    }

    const { data: bomData, error } = await supabase
      .from('bill_of_materials')
      .select('id, bom_number, product_name')
      .eq('warehouse_item_id', warehouseItemId)
      .single();

    if (!error && bomData) {
      const bomMeta = {
        bom_id: bomData.id,
        bom_number: bomData.bom_number,
        product_name: bomData.product_name
      };
      bomByWarehouseItemIdCache.set(warehouseItemId, bomMeta);
      return bomMeta;
    }
    return null;
  };

  // Helper function to fetch BOM by finished good ID using the bom_finished_goods link table
  const fetchBomByFinishedGoodId = async (finishedGoodId: string) => {
    const cacheKey = `fg_${finishedGoodId}`;
    if (bomByWarehouseItemIdCache.has(cacheKey)) {
      return bomByWarehouseItemIdCache.get(cacheKey);
    }

    const { data: linkData, error } = await supabase
      .from('bom_finished_goods')
      .select('bom_id, bill_of_materials(id, bom_number, product_name)')
      .eq('finished_good_id', finishedGoodId)
      .maybeSingle();

    if (!error && linkData && linkData.bill_of_materials) {
      const bom = Array.isArray(linkData.bill_of_materials) ? linkData.bill_of_materials[0] : linkData.bill_of_materials;
      const bomMeta = {
        bom_id: bom.id,
        bom_number: bom.bom_number,
        product_name: bom.product_name
      };
      bomByWarehouseItemIdCache.set(cacheKey, bomMeta);
      return bomMeta;
    }
    return null;
  };

  // Helper function to fetch BOM items
  const fetchBomItems = async (bomId: string) => {
    if (bomItemsByBomIdCache.has(bomId)) {
      return bomItemsByBomIdCache.get(bomId);
    }

    const { data: bomItems, error } = await supabase
      .from('bom_items')
      .select('*')
      .eq('bom_id', bomId);

    if (!error && bomItems) {
      bomItemsByBomIdCache.set(bomId, bomItems);
      return bomItems;
    }
    return [];
  };

  // Recursive function to explode sub-BOMs
  const explodeSubBom = async (params: {
    warehouse_item_id: string;
    requiredQty: number;
    visitedBomIds: Set<string>;
    path: string[];
    warehouseItemsMap: Map<string, any>;
  }): Promise<DemandAnalysisResult[]> => {
    const { warehouse_item_id, requiredQty, visitedBomIds, path, warehouseItemsMap } = params;
    
    console.log(`🔍 Exploding sub-BOM for warehouse_item_id: ${warehouse_item_id}, required: ${requiredQty}, path: ${path.join(' -> ')}`);
    
    const results: DemandAnalysisResult[] = [];
    
    // Check if this warehouse item has a BOM
    const bomMeta = await fetchBomByWarehouseItemId(warehouse_item_id);
    if (!bomMeta) {
      console.log(`  ❌ No BOM found for warehouse_item_id: ${warehouse_item_id}`);
      return results;
    }

    // Prevent cycles
    if (visitedBomIds.has(bomMeta.bom_id)) {
      console.log(`  🔄 Cycle detected, skipping BOM: ${bomMeta.bom_number}`);
      return results;
    }

    visitedBomIds.add(bomMeta.bom_id);
    console.log(`  📋 Found BOM: ${bomMeta.bom_number} for ${bomMeta.product_name}`);

    const bomItems = await fetchBomItems(bomMeta.bom_id);
    
    for (const subItem of bomItems) {
      const consumptionPerUnit = Number(subItem.consumption) || Number(subItem.quantity) || 0;
      const subRequired = requiredQty * consumptionPerUnit;
      
      console.log(`    📦 Sub-item: ${subItem.item_name} (${subItem.item_code}), consumption: ${consumptionPerUnit}, required: ${subRequired}`);
      
      const warehouseItem = warehouseItemsMap.get(subItem.item_code);
      const availableStock = Number(warehouseItem?.current_stock) || 0;
      const subShortage = Math.max(0, subRequired - availableStock);
      
      console.log(`      Stock: ${availableStock}, shortage: ${subShortage}`);
      
      // If there's a shortage and this sub-item has its own BOM, recurse
      if (subShortage > 0 && subItem.warehouse_item_id) {
        const nestedResults = await explodeSubBom({
          warehouse_item_id: subItem.warehouse_item_id,
          requiredQty: subShortage,
          visitedBomIds: new Set(visitedBomIds),
          path: [...path, subItem.item_name],
          warehouseItemsMap
        });
        
        // Merge nested results
        for (const nestedResult of nestedResults) {
          const existingIndex = results.findIndex(r => r.item_code === nestedResult.item_code);
          if (existingIndex >= 0) {
            results[existingIndex].total_required += nestedResult.total_required;
            results[existingIndex].shortage = Math.max(0, results[existingIndex].total_required - results[existingIndex].available_stock);
            results[existingIndex].suggested_order = results[existingIndex].shortage;
          } else {
            results.push(nestedResult);
          }
        }
      } else {
        // Add leaf material requirement
        const existingIndex = results.findIndex(r => r.item_code === subItem.item_code);
        if (existingIndex >= 0) {
          results[existingIndex].total_required += subRequired;
          results[existingIndex].shortage = Math.max(0, results[existingIndex].total_required - results[existingIndex].available_stock);
          results[existingIndex].suggested_order = results[existingIndex].shortage;
        } else {
          results.push({
            item_code: subItem.item_code || 'N/A',
            item_name: subItem.item_name,
            total_required: subRequired,
            available_stock: availableStock,
            on_order: 0, // Sub-level on-order quantities are initially 0
            shortage: subShortage,
            suggested_order: subShortage,
            unit_of_measure: subItem.unit_of_measure,
            category: 'BOM Material',
            priority: subShortage > 0 ? 'high' : 'medium',
            lead_time_days: 7,
            is_linked_to_bom: true,
            bom_info: {
              bom_number: bomMeta.bom_number,
              product_name: bomMeta.product_name
            }
          });
        }
      }
    }
    
    visitedBomIds.delete(bomMeta.bom_id);
    return results;
  };

  const calculateBOMDemandMutation = useMutation({
    mutationFn: async (input: DemandCalculationInput): Promise<DemandAnalysisResult[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      console.log('=== Multi-level BOM Demand Calculation Started ===');
      console.log('Input:', input);

      // Get BOM details including size
      const { data: bomDetails, error: bomDetailsError } = await supabase
        .from('bill_of_materials')
        .select('product_name, size')
        .eq('id', input.bom_id)
        .single();

      if (bomDetailsError) throw bomDetailsError;

      // Get size multiplier if BOM has a size
      let sizeMultiplier = 1.0;
      if (bomDetails?.size) {
        const { data: multiplierData } = await supabase
          .from('bom_size_multipliers')
          .select('multiplier')
          .eq('bom_id', input.bom_id)
          .eq('size', bomDetails.size)
          .maybeSingle();
        
        sizeMultiplier = multiplierData?.multiplier || 1.0;
        console.log(`📏 BOM Size: ${bomDetails.size}, Multiplier: ${sizeMultiplier}x`);
      }

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
          .select('id, item_code, name, current_stock, reserved_quantity, reorder_level, min_stock_level, unit_cost, supplier_id, company_id');
        
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

      // Create warehouse items map for efficient lookup
      const warehouseItemsMap = new Map();
      warehouseItems?.forEach(wi => {
        if (wi.item_code) {
          warehouseItemsMap.set(wi.item_code, wi);
        }
      });

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

      // Calculate demand analysis with multi-level BOM explosion
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
        
        // Apply size multiplier to consumption
        const baseConsumption = bomItem.consumption || bomItem.quantity || 0;
        const adjustedConsumption = baseConsumption * sizeMultiplier;
        const totalRequired = adjustedConsumption * input.production_quantity;
        const availableStock = warehouseItem?.current_stock || 0;
        const reservedQty = warehouseItem?.reserved_quantity || 0;
        const onOrder = relatedPOItems.reduce((sum, item) => sum + (item.quantity_pending || 0), 0);
        const shortage = Math.max(0, totalRequired - availableStock - onOrder);
        const safetyStock = input.include_safety_stock ? (warehouseItem?.min_stock_level || 0) : 0;
        const suggestedOrder = shortage > 0 ? shortage + safetyStock : 0;

        // Check if this component has sub-BOM and shortage exists
        if (shortage > 0 && bomItem.warehouse_item_id) {
          console.log(`🔍 Checking for sub-BOM for component: ${bomItem.item_name} (shortage: ${shortage})`);
          
          const subBomResults = await explodeSubBom({
            warehouse_item_id: bomItem.warehouse_item_id,
            requiredQty: shortage,
            visitedBomIds: new Set([input.bom_id]),
            path: [bomItem.item_name],
            warehouseItemsMap
          });

          if (subBomResults.length > 0) {
            console.log(`  ✓ Found sub-BOM materials: ${subBomResults.length} items`);
            
            // Merge sub-BOM results into analysis, aggregating by item_code
            for (const subResult of subBomResults) {
              const existingIndex = analysis.findIndex(r => r.item_code === subResult.item_code);
              if (existingIndex >= 0) {
                analysis[existingIndex].total_required += subResult.total_required;
                analysis[existingIndex].shortage = Math.max(0, analysis[existingIndex].total_required - analysis[existingIndex].available_stock - analysis[existingIndex].on_order);
                analysis[existingIndex].suggested_order = analysis[existingIndex].shortage + (input.include_safety_stock ? (warehouseItemsMap.get(subResult.item_code)?.min_stock_level || 0) : 0);
              } else {
                analysis.push({
                  ...subResult,
                  suggested_order: subResult.shortage + (input.include_safety_stock ? (warehouseItemsMap.get(subResult.item_code)?.min_stock_level || 0) : 0)
                });
              }
            }
            
            // Do NOT add the component shortage line (avoid double counting)
            continue;
          }
        }

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

        // Add component-level analysis
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

      console.log(`=== Multi-level BOM Demand Calculation Complete ===`);
      console.log(`${matchedItems} matched, ${unmatchedItems} unmatched items`);
      console.log(`Analysis results: ${analysis.length} items`);
      if (sizeMultiplier !== 1.0) {
        console.log(`📏 Size multiplier ${sizeMultiplier}x applied to all materials`);
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
      
      // Fetch customer purchase orders and their items WITH linked finished goods
      const { data: customerPOs, error: cpoError } = await supabase
        .from('customer_purchase_orders')
        .select(`
          *,
          customer:customers(customer_name, customer_code),
          items:customer_po_items(
            *,
            linked_fg:finished_goods!customer_po_items_finished_good_id_fkey(
              style_no,
              size,
              color,
              product_code,
              product_name,
              current_stock
            )
          )
        `)
        .in('id', input.cpo_ids);

      if (cpoError) {
        console.error('Error fetching customer purchase orders:', cpoError);
        throw new Error('Failed to fetch customer purchase orders');
      }

      console.log('Fetched customer POs:', customerPOs?.length);

      // Fetch finished goods without nested relations (no FK between finished_goods and bill_of_materials)
      const { data: finishedGoods, error: fgError } = await supabase
        .from('finished_goods')
        .select('*');

      if (fgError) {
        console.error('Error fetching finished goods:', fgError);
        throw new Error('Failed to fetch finished goods');
      }

      // Fetch warehouse items for stock information including reserved quantities
      const { data: warehouseItems, error: wiError } = await supabase
        .from('warehouse_items')
        .select('id, item_code, name, current_stock, reserved_quantity, reorder_level, min_stock_level, unit_cost, supplier_id, company_id');

      if (wiError) {
        console.error('Error fetching warehouse items:', wiError);
        throw new Error('Failed to fetch warehouse items');
      }

      // Create lookup maps for efficient matching
      const finishedGoodsMap = new Map();
      const finishedGoodsByStyleSizeColor = new Map(); // NEW: Composite key matching
      const warehouseItemsMap = new Map();
      // Track remaining FG stock across all CPO items during this calculation
      const remainingFgStock = new Map();
      // Cache BOM data to avoid repeated network calls
      const bomItemsCache = new Map();
      const bomMetaCache = new Map();
      
      finishedGoods?.forEach(fg => {
        if (fg.id) {
          // Existing ID-based mapping
          finishedGoodsMap.set(fg.id, fg);
          remainingFgStock.set(fg.id, Number(fg.current_stock) || 0);
        }
        
        // NEW: Style + Size + Color composite key mapping with NORMALIZATION
        if (fg.style_no && fg.size && fg.color) {
          // Normalize: trim whitespace and lowercase for consistent matching
          const compositeKey = `${fg.style_no.trim()}|${fg.size.trim()}|${fg.color.trim()}`.toLowerCase();
          
          // Support multiple FGs with same style/size/color (different batches/locations)
          if (!finishedGoodsByStyleSizeColor.has(compositeKey)) {
            finishedGoodsByStyleSizeColor.set(compositeKey, []);
          }
          finishedGoodsByStyleSizeColor.get(compositeKey).push(fg);
        }
      });
      
      warehouseItems?.forEach(wi => {
        if (wi.item_code) {
          warehouseItemsMap.set(wi.item_code, wi);
        }
      });

      console.log(`Finished goods indexed: ${finishedGoodsMap.size} by ID, ${finishedGoodsByStyleSizeColor.size} by style/size/color`);

      // Helper function to extract style number from item name (e.g., "T-Shirt STY-001 Blue XL" -> "STY-001")
      const extractStyleFromItemName = (itemName: string) => {
        if (!itemName) return null;
        // Common patterns: STY-001, STYLE001, etc.
        const styleMatch = itemName.match(/\b(STY[-_]?\w+|\w+[-_]?STYLE\w*)\b/i);
        return styleMatch ? styleMatch[1] : null;
      };

      // Helper function to find matching finished goods with ENHANCED MULTI-STRATEGY MATCHING
      const findMatchingFinishedGoods = (cpoItem: ExtendedCPOItem) => {
        // Strategy 1: Direct ID match (highest priority)
        if (cpoItem.finished_good_id) {
          const directMatch = finishedGoodsMap.get(cpoItem.finished_good_id);
          if (directMatch) {
            console.log(`✓ Direct ID match found for ${cpoItem.item_name}`);
            return { matches: [directMatch], strategy: 'direct_id', confidence: 'high' };
          }
        }
        
        // Strategy 2: Extract attributes from linked finished good (from query join)
        const linkedFg = cpoItem.linked_fg;
        let cpoStyleNo = cpoItem.style_no;
        let cpoSize = cpoItem.size;
        let cpoColor = cpoItem.color;
        
        // If CPO item doesn't have attributes, try to get from linked FG
        if (!cpoStyleNo && linkedFg?.style_no) {
          cpoStyleNo = linkedFg.style_no;
          console.log(`  📋 Extracted style_no from linked FG: ${cpoStyleNo}`);
        }
        if (!cpoSize && linkedFg?.size) {
          cpoSize = linkedFg.size;
          console.log(`  📋 Extracted size from linked FG: ${cpoSize}`);
        }
        if (!cpoColor && linkedFg?.color) {
          cpoColor = linkedFg.color;
          console.log(`  📋 Extracted color from linked FG: ${cpoColor}`);
        }
        
        // Strategy 3: Style + Size + Color composite match
        if (cpoStyleNo && cpoSize && cpoColor) {
          // Normalize: trim and lowercase for consistent matching
          const compositeKey = `${cpoStyleNo.trim()}|${cpoSize.trim()}|${cpoColor.trim()}`.toLowerCase();
          const matches = finishedGoodsByStyleSizeColor.get(compositeKey);
          
          if (matches && matches.length > 0) {
            console.log(`✓ Composite match (style/size/color): Found ${matches.length} finished good(s)`);
            return { matches, strategy: 'composite_match', confidence: 'high' };
          }
        }
        
        // Strategy 4: Partial match (style + size only)
        if (cpoStyleNo && cpoSize) {
          const normalizedStyle = cpoStyleNo.trim().toLowerCase();
          const normalizedSize = cpoSize.trim().toLowerCase();
          
          const partialMatches = Array.from(finishedGoodsByStyleSizeColor.entries())
            .filter(([key]) => {
              const [style, size] = key.split('|');
              return style === normalizedStyle && size === normalizedSize;
            })
            .flatMap(([_, fgs]) => fgs);
          
          if (partialMatches.length > 0) {
            console.log(`⚠ Partial match (style+size): Found ${partialMatches.length} finished good(s)`);
            return { matches: partialMatches, strategy: 'partial_match', confidence: 'medium' };
          }
        }
        
        // Strategy 4.5: Size + Color match (when no style but has size and color)
        if (!cpoStyleNo && cpoSize && cpoColor) {
          const normalizedSize = cpoSize.trim().toLowerCase();
          const normalizedColor = cpoColor.trim().toLowerCase();
          
          const sizeColorMatches = Array.from(finishedGoodsByStyleSizeColor.entries())
            .filter(([key]) => {
              const parts = key.split('|');
              if (parts.length < 3) return false;
              const [style, size, color] = parts;
              return size === normalizedSize && color === normalizedColor;
            })
            .flatMap(([_, fgs]) => fgs);
          
          if (sizeColorMatches.length > 0) {
            console.log(`⚠ Size+Color match (no style): Found ${sizeColorMatches.length} finished good(s)`);
            
            // Optional: Further filter by item name similarity for higher confidence
            const itemNameLower = cpoItem.item_name?.toLowerCase() || '';
            const nameFilteredMatches = sizeColorMatches.filter(fg => {
              const fgNameLower = fg.product_name?.toLowerCase() || '';
              // Check if names share significant words
              const cpoWords = itemNameLower.split(/\s+/).filter(w => w.length > 3);
              const fgWords = fgNameLower.split(/\s+/).filter(w => w.length > 3);
              const commonWords = cpoWords.filter(w => fgWords.includes(w));
              return commonWords.length > 0; // At least one word in common
            });
            
            const finalMatches = nameFilteredMatches.length > 0 ? nameFilteredMatches : sizeColorMatches;
            
            return {
              matches: finalMatches,
              strategy: 'size_color_match',
              confidence: nameFilteredMatches.length > 0 ? 'medium' : 'low'
            };
          }
        }
        
        // Strategy 5: Style-only match (lowest confidence)
        if (cpoStyleNo) {
          const normalizedStyle = cpoStyleNo.trim().toLowerCase();
          
          const styleMatches = Array.from(finishedGoodsByStyleSizeColor.entries())
            .filter(([key]) => key.startsWith(normalizedStyle + '|'))
            .flatMap(([_, fgs]) => fgs);
          
          if (styleMatches.length > 0) {
            console.log(`⚠ Style-only match: Found ${styleMatches.length} finished good(s)`);
            return { matches: styleMatches, strategy: 'style_only', confidence: 'low' };
          }
        }
        
        // Strategy 6: Fallback to style extraction from item name
        const extractedStyle = extractStyleFromItemName(cpoItem.item_name);
        if (extractedStyle && extractedStyle !== cpoStyleNo) {
          const normalizedStyle = extractedStyle.trim().toLowerCase();
          const extractedMatches = Array.from(finishedGoodsByStyleSizeColor.entries())
            .filter(([key]) => key.startsWith(normalizedStyle + '|'))
            .flatMap(([_, fgs]) => fgs);
          
          if (extractedMatches.length > 0) {
            console.log(`⚠ Extracted style match: Found ${extractedMatches.length} finished good(s)`);
            return { matches: extractedMatches, strategy: 'extracted_style', confidence: 'low' };
          }
        }
        
        console.log(`❌ No finished good match found for ${cpoItem.item_name}`);
        console.log(`   Attempted with: style=${cpoStyleNo || 'N/A'}, size=${cpoSize || 'N/A'}, color=${cpoColor || 'N/A'}`);
        return { matches: [], strategy: 'no_match', confidence: 'none' };
      };

      // Process each customer purchase order in deterministic order (by delivery/PO date)
      const sortedCPOs = [...(customerPOs || [])].sort((a, b) => {
        const da = new Date(a.delivery_date || a.po_date || a.created_at);
        const db = new Date(b.delivery_date || b.po_date || b.created_at);
        return da.getTime() - db.getTime();
      });
      
      for (const cpo of sortedCPOs) {
        console.log(`\n--- Processing CPO: ${cpo.cpo_number} ---`);
        
        for (const cpoItem of cpo.items || []) {
          const extendedCpoItem = cpoItem as ExtendedCPOItem;
          console.log(`\nProcessing CPO Item: ${extendedCpoItem.item_name}`);
          console.log(`  CPO Attributes - Style: ${extendedCpoItem.style_no || 'N/A'}, Size: ${extendedCpoItem.size || 'N/A'}, Color: ${extendedCpoItem.color || 'N/A'}`);
          if (extendedCpoItem.linked_fg) {
            console.log(`  Linked FG Attributes - Style: ${extendedCpoItem.linked_fg.style_no || 'N/A'}, Size: ${extendedCpoItem.linked_fg.size || 'N/A'}, Color: ${extendedCpoItem.linked_fg.color || 'N/A'}`);
          }
          console.log(`  Quantity: ${extendedCpoItem.quantity_ordered}`);
          
          // NEW: Use smart matching function with multi-strategy approach
          const matchResult = findMatchingFinishedGoods(extendedCpoItem);
          const matchedFinishedGoods = matchResult.matches;
          console.log(`  Match Strategy: ${matchResult.strategy}, Confidence: ${matchResult.confidence}`);
          
          if (matchedFinishedGoods.length > 0) {
            // Calculate total available stock across all matching finished goods
            const totalAvailableStock = matchedFinishedGoods.reduce((sum, fg) => {
              return sum + (Number(remainingFgStock.get(fg.id)) || 0);
            }, 0);
            
            console.log(`✓ Matched ${matchedFinishedGoods.length} finished good(s)`);
            console.log(`  Total available stock: ${totalAvailableStock}`);
            
            const cpoQuantity = Number(extendedCpoItem.quantity_ordered) * (input.multiplier || 1);
            let remainingToFulfill = cpoQuantity;
            let totalUsedFromStock = 0;
            
            // Consume stock from matched finished goods (FIFO - first match gets priority)
            for (const matchedFg of matchedFinishedGoods) {
              if (remainingToFulfill <= 0) break;
              
              const fgId = matchedFg.id;
              const currentRemaining = Number(remainingFgStock.get(fgId)) || 0;
              const usedFromThis = Math.min(currentRemaining, remainingToFulfill);
              
              if (usedFromThis > 0) {
                totalUsedFromStock += usedFromThis;
                remainingToFulfill -= usedFromThis;
                remainingFgStock.set(fgId, currentRemaining - usedFromThis);
                
                console.log(`  Used ${usedFromThis} from ${matchedFg.product_name} (${matchedFg.product_code})`);
              }
            }
            
            const requiredProduction = Math.max(0, remainingToFulfill);
            
            console.log(`  Stock fulfillment: ${totalUsedFromStock}/${cpoQuantity}`);
            console.log(`  Production required: ${requiredProduction}`);
            
            // Record stock fulfillment (if any)
            if (totalUsedFromStock > 0) {
              analysisResults.push({
                item_code: matchedFinishedGoods[0].product_code || 'N/A',
                item_name: extendedCpoItem.item_name,
                total_required: totalUsedFromStock,
                available_stock: totalAvailableStock,
                on_order: 0,
                shortage: 0,
                suggested_order: 0,
                unit_of_measure: 'pcs',
                category: 'Fulfilled from Stock',
                priority: 'low',
                lead_time_days: 0,
                finished_good_info: {
                  product_code: matchedFinishedGoods[0].product_code,
                  product_name: matchedFinishedGoods[0].product_name,
                  current_stock: totalAvailableStock
                }
              });
            }
            
            if (requiredProduction > 0) {
              // Use the first matched finished good for BOM lookup
              console.log(`⚡ Production required: ${requiredProduction} units`);
              const primaryFg = matchedFinishedGoods[0];
              
              // Fetch BOM by finished_good_id (new relationship)
              const bomMeta = await fetchBomByFinishedGoodId(primaryFg.id);
              if (bomMeta) {
                const bomId = bomMeta.bom_id;
                console.log(`📋 Found BOM: ${bomMeta.bom_number} for finished good: ${primaryFg.product_name}`);
                
                // Fetch BOM items (with caching)
                let bomItems = bomItemsCache.get(bomId);
                if (!bomItems) {
                  const { data: fetchedBomItems, error: bomErr } = await supabase
                    .from('bom_items')
                    .select('id,item_name,item_code,quantity,unit_of_measure,consumption,warehouse_item_id')
                    .eq('bom_id', bomId);
                  if (bomErr) {
                    console.warn('Failed to fetch BOM items for', bomId, bomErr);
                  }
                  bomItems = fetchedBomItems || [];
                  bomItemsCache.set(bomId, bomItems);
                }
                
                if (bomItems && bomItems.length > 0) {
                  console.log('📋 Expanding BOM for shortfall quantity...');
                  for (const bomItem of bomItems) {
                    const consumptionPerUnit = Number(bomItem.consumption) || Number(bomItem.quantity) || 0;
                    const materialRequired = requiredProduction * consumptionPerUnit;
                    
                    const warehouseItem = warehouseItemsMap.get(bomItem.item_code);
                    const currentMaterialStock = Number(warehouseItem?.current_stock) || 0;
                    const reservedQty = Number(warehouseItem?.reserved_quantity) || 0;
                    const materialShortage = Math.max(0, materialRequired - currentMaterialStock);
                    
                    console.log(`    📦 Component: ${bomItem.item_name} (${bomItem.item_code})`);
                    console.log(`      Required: ${materialRequired}, Stock: ${currentMaterialStock}, Shortage: ${materialShortage}`);
                    
                    // Check for sub-BOM if there's a shortage and warehouse_item_id exists
                    if (materialShortage > 0 && bomItem.warehouse_item_id) {
                      console.log(`      🔍 Checking for sub-BOM...`);
                      
                      const subBomResults = await explodeSubBom({
                        warehouse_item_id: bomItem.warehouse_item_id,
                        requiredQty: materialShortage,
                        visitedBomIds: new Set([bomId]),
                        path: [bomItem.item_name],
                        warehouseItemsMap
                      });

                      if (subBomResults.length > 0) {
                        console.log(`        ✓ Found sub-BOM materials: ${subBomResults.length} items`);
                        
                        // Merge sub-BOM results into analysis, aggregating by item_code
                        for (const subResult of subBomResults) {
                          let existingResult = analysisResults.find(r => r.item_code === subResult.item_code);
                          if (existingResult) {
                            existingResult.total_required += subResult.total_required;
                            existingResult.available_stock = Math.max(existingResult.available_stock, subResult.available_stock);
                            existingResult.shortage = Math.max(0, existingResult.total_required - existingResult.available_stock);
                            existingResult.suggested_order = existingResult.shortage;
                          } else {
                            analysisResults.push(subResult);
                          }
                        }
                        
                        // Do NOT add the component shortage line (avoid double counting)
                        continue;
                      }
                    }
                    
                    // Add component-level analysis (leaf material or no sub-BOM)
                    let existingResult = analysisResults.find(r => r.item_code === bomItem.item_code);
                    
                    // NEW: Track CPO contribution for this material
                    const cpoContribution = {
                      cpo_id: cpo.id,
                      cpo_number: cpo.cpo_number,
                      customer_name: cpo.customer?.customer_name || 'Unknown Customer',
                      quantity_contributed: materialRequired
                    };
                    
                    if (existingResult) {
                      existingResult.total_required += materialRequired;
                      existingResult.shortage = Math.max(0, existingResult.total_required - existingResult.available_stock);
                      existingResult.suggested_order = existingResult.shortage;
                      
                      // NEW: Merge CPO contribution
                      if (!existingResult.cpo_details) {
                        existingResult.cpo_details = [];
                      }
                      existingResult.cpo_details.push(cpoContribution);
                      existingResult.total_cpos_involved = existingResult.cpo_details.length;
                    } else {
                    analysisResults.push({
                      item_code: bomItem.item_code || 'N/A',
                      item_name: bomItem.item_name,
                      total_required: materialRequired,
                      available_stock: currentMaterialStock,
                      reserved_quantity: Number(warehouseItem?.reserved_quantity) || 0,
                      warehouse_item_id: bomItem.warehouse_item_id,
                      bom_id: bomId,
                      bom_item_id: bomItem.id,
                      on_order: 0,
                      shortage: materialShortage,
                      suggested_order: materialShortage,
                      unit_of_measure: bomItem.unit_of_measure,
                      category: 'BOM Material',
                      priority: materialShortage > 0 ? 'high' : 'medium',
                      lead_time_days: 7,
                      is_linked_to_bom: true,
                      bom_info: {
                        bom_number: bomMeta.bom_number,
                        product_name: bomMeta.product_name
                      },
                      finished_good_info: {
                        product_code: primaryFg.product_code,
                        product_name: primaryFg.product_name,
                        current_stock: totalAvailableStock
                      },
                      cpo_details: [cpoContribution],
                      total_cpos_involved: 1
                    });
                    }
                  }
                } else {
                  // No BOM items found
                  analysisResults.push({
                    item_code: primaryFg.product_code || 'N/A',
                    item_name: extendedCpoItem.item_name,
                    total_required: requiredProduction,
                    available_stock: totalAvailableStock,
                    on_order: 0,
                    shortage: requiredProduction,
                    suggested_order: requiredProduction,
                    unit_of_measure: 'pcs',
                    category: 'Production Required (No BOM)',
                    priority: 'urgent',
                    lead_time_days: 14,
                    finished_good_info: {
                      product_code: primaryFg.product_code,
                      product_name: primaryFg.product_name,
                      current_stock: totalAvailableStock
                    }
                  });
                }
              } else {
                // No BOM found for this finished good
                console.log(`⚠️ No BOM found for finished good: ${primaryFg.product_name}`);
                analysisResults.push({
                  item_code: primaryFg.product_code || 'N/A',
                  item_name: extendedCpoItem.item_name,
                  total_required: requiredProduction,
                  available_stock: totalAvailableStock,
                  on_order: 0,
                  shortage: requiredProduction,
                  suggested_order: requiredProduction,
                  unit_of_measure: 'pcs',
                  category: 'Production Required (No BOM)',
                  priority: 'urgent',
                  lead_time_days: 14,
                  finished_good_info: {
                    product_code: primaryFg.product_code,
                    product_name: primaryFg.product_name,
                    current_stock: totalAvailableStock
                  }
                });
              }
            }
          } else {
            // No matching finished goods found
            console.log('❌ No finished good match - item cannot be fulfilled');
            
            analysisResults.push({
              item_code: 'UNMATCHED',
              item_name: extendedCpoItem.item_name,
              total_required: Number(extendedCpoItem.quantity_ordered) * (input.multiplier || 1),
              available_stock: 0,
              on_order: 0,
              shortage: Number(extendedCpoItem.quantity_ordered) * (input.multiplier || 1),
              suggested_order: Number(extendedCpoItem.quantity_ordered) * (input.multiplier || 1),
              unit_of_measure: extendedCpoItem.unit_of_measure || 'pcs',
              category: 'No Matching Product',
              priority: 'urgent',
              lead_time_days: 14,
              supplier_info: {
                supplier_id: cpo.customer_id || '',
                supplier_name: cpo.customer?.customer_name || 'Unknown Customer',
                last_unit_cost: extendedCpoItem.unit_price
              }
            });
          }
        }
      }

      console.log(`=== CPO Demand Calculation Complete ===`);
      console.log(`Total analysis results: ${analysisResults.length}`);
      console.log(`Items requiring production: ${analysisResults.filter(r => r.category === 'BOM Material' && r.shortage > 0).length}`);
      console.log(`Items fulfilled from stock: ${analysisResults.filter(r => r.category === 'Fulfilled from Stock').length}`);
      console.log(`Items needing BOM creation: ${analysisResults.filter(r => r.category === 'Production Required (No BOM)').length}`);
      console.log(`Unmatched items: ${analysisResults.filter(r => r.category === 'No Matching Product').length}`);

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