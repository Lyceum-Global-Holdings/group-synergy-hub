import { supabase } from '@/integrations/supabase/client';

export interface ReconcileItemInput {
  id: string;
  item_code: string;
  name: string;
  current_stock: number;
  bin_total: number;
  bin_count: number;
  status: 'ok' | 'desync' | 'no_bins';
}

export interface ReconcileOverride {
  locationId: string;
  binId: string;
}

export interface ReconcileResult {
  itemId: string;
  itemCode: string;
  action: 'fixed' | 'created' | 'blocked' | 'failed';
  message: string;
}

/**
 * Shared reconciliation engine. Reconciles a single item's bin allocations
 * to match its current_stock. Scoped by company_id.
 * 
 * Flow:
 * 1. Load item's company_id + location_id from DB
 * 2. Load allocations scoped by item + company
 * 3. If no allocations (no_bins): create one at the override bin or first active bin at item location
 * 4. If allocations exist (desync): adjust the primary location-matching allocation
 */
export async function reconcileItem(
  item: ReconcileItemInput,
  companyId: string,
  override?: ReconcileOverride
): Promise<ReconcileResult> {
  try {
    // 1. Load item details
    const { data: itemData, error: itemError } = await supabase
      .from('warehouse_items')
      .select('location_id, company_id')
      .eq('id', item.id)
      .single();

    if (itemError) {
      return { itemId: item.id, itemCode: item.item_code, action: 'failed', message: itemError.message };
    }

    const effectiveLocationId = override?.locationId || itemData?.location_id;
    // Note: effectiveLocationId may be null — handled below per case

    // 2. Load allocations scoped by company
    const { data: allocations, error: allocError } = await supabase
      .from('warehouse_bin_allocations')
      .select('id, bin_id, allocated_quantity, reserved_quantity, warehouse_bins!inner(location_id)')
      .eq('warehouse_item_id', item.id)
      .eq('company_id', companyId)
      .order('allocated_quantity', { ascending: false });

    if (allocError) {
      return { itemId: item.id, itemCode: item.item_code, action: 'failed', message: allocError.message };
    }

    const { data: { user } } = await supabase.auth.getUser();

    // 3. No allocations → create one
    if (!allocations || allocations.length === 0) {
      const targetBinId = override?.binId || await findFirstActiveBin(effectiveLocationId);

      if (!targetBinId) {
        return { itemId: item.id, itemCode: item.item_code, action: 'blocked', message: 'No active bins at location' };
      }

      const { error: insertError } = await supabase
        .from('warehouse_bin_allocations')
        .insert({
          warehouse_item_id: item.id,
          bin_id: targetBinId,
          allocated_quantity: item.current_stock,
          reserved_quantity: 0,
          company_id: companyId,
          created_by: user?.id || null,
        });

      if (insertError) {
        return { itemId: item.id, itemCode: item.item_code, action: 'failed', message: insertError.message };
      }

      return { itemId: item.id, itemCode: item.item_code, action: 'created', message: 'Bin allocation created' };
    }

    // 4. Allocations exist → adjust the primary location-matching one
    const locationAllocations = allocations.filter(
      (a: any) => a.warehouse_bins?.location_id === effectiveLocationId
    );

    if (locationAllocations.length > 0) {
      // Adjust the first location-matching allocation
      const primaryAlloc = locationAllocations[0];
      const otherTotal = allocations
        .filter((a: any) => a.id !== primaryAlloc.id)
        .reduce((sum, a) => sum + (a.allocated_quantity || 0), 0);
      const newPrimaryQty = Math.max(0, item.current_stock - otherTotal);
      const newReserved = Math.min(primaryAlloc.reserved_quantity || 0, newPrimaryQty);

      const { error: updateError } = await supabase
        .from('warehouse_bin_allocations')
        .update({
          allocated_quantity: newPrimaryQty,
          reserved_quantity: newReserved,
          updated_at: new Date().toISOString(),
        })
        .eq('id', primaryAlloc.id);

      if (updateError) {
        return { itemId: item.id, itemCode: item.item_code, action: 'failed', message: updateError.message };
      }

      return { itemId: item.id, itemCode: item.item_code, action: 'fixed', message: 'Allocation adjusted' };
    }

    // 5. No allocation at the correct location → create one there
    const targetBinId = override?.binId || await findFirstActiveBin(effectiveLocationId);

    if (!targetBinId) {
      return { itemId: item.id, itemCode: item.item_code, action: 'blocked', message: 'No active bins at item location' };
    }

    // Sum of existing allocations at OTHER locations
    const existingTotal = allocations.reduce((sum, a) => sum + (a.allocated_quantity || 0), 0);
    const newQty = Math.max(0, item.current_stock - existingTotal);

    if (newQty > 0) {
      const { error: insertError } = await supabase
        .from('warehouse_bin_allocations')
        .insert({
          warehouse_item_id: item.id,
          bin_id: targetBinId,
          allocated_quantity: newQty,
          reserved_quantity: 0,
          company_id: companyId,
          created_by: user?.id || null,
        });

      if (insertError) {
        return { itemId: item.id, itemCode: item.item_code, action: 'failed', message: insertError.message };
      }
    }

    return { itemId: item.id, itemCode: item.item_code, action: 'created', message: 'New allocation at correct location' };
  } catch (err: any) {
    return { itemId: item.id, itemCode: item.item_code, action: 'failed', message: err.message || 'Unknown error' };
  }
}

/**
 * Find the first active bin at a location, ordered by bin_code ASC.
 */
async function findFirstActiveBin(locationId: string): Promise<string | null> {
  const { data: bins } = await supabase
    .from('warehouse_bins')
    .select('id')
    .eq('location_id', locationId)
    .eq('status', 'active')
    .order('bin_code', { ascending: true })
    .limit(1);

  return bins?.[0]?.id || null;
}

/**
 * Reconcile multiple items. Returns summary of results.
 */
export async function reconcileItems(
  items: ReconcileItemInput[],
  companyId: string,
  overrides?: Map<string, ReconcileOverride>
): Promise<{ results: ReconcileResult[]; fixed: number; created: number; blocked: number; failed: number }> {
  const results: ReconcileResult[] = [];

  for (const item of items) {
    const override = overrides?.get(item.id);
    const result = await reconcileItem(item, companyId, override);
    results.push(result);
  }

  return {
    results,
    fixed: results.filter(r => r.action === 'fixed').length,
    created: results.filter(r => r.action === 'created').length,
    blocked: results.filter(r => r.action === 'blocked').length,
    failed: results.filter(r => r.action === 'failed').length,
  };
}
