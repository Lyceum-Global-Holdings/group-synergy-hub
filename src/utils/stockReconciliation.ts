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
      .from('warehouse_items_full')
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
      if (!effectiveLocationId) {
        return { itemId: item.id, itemCode: item.item_code, action: 'blocked', message: 'No warehouse location assigned' };
      }

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

    // 4. Allocations exist → adjust the primary one
    // Try location-matching allocations first
    const locationAllocations = effectiveLocationId
      ? allocations.filter((a: any) => a.warehouse_bins?.location_id === effectiveLocationId)
      : [];

    // Pick primary allocation: prefer location-matched, otherwise use first existing
    const primaryAlloc = locationAllocations.length > 0 ? locationAllocations[0] : allocations[0];

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
 * Reconcile multiple items via server-side batch RPC.
 * Single DB call instead of N sequential client-side requests.
 */
export async function reconcileItems(
  items: ReconcileItemInput[],
  companyId: string,
  overrides?: Map<string, ReconcileOverride>,
  locationId?: string | null,
): Promise<{ results: ReconcileResult[]; fixed: number; created: number; blocked: number; failed: number }> {
  const { data: { user } } = await supabase.auth.getUser();

  // Build overrides JSONB: { "item-uuid": { "locationId": "...", "binId": "..." } }
  const overridesObj: Record<string, { locationId: string; binId: string }> = {};
  if (overrides) {
    overrides.forEach((val, key) => {
      overridesObj[key] = val;
    });
  }

  const { data, error } = await supabase.rpc('reconcile_stock_batch', {
    p_item_ids: items.map(i => i.id),
    p_company_id: companyId,
    p_overrides: overridesObj,
    p_user_id: user?.id || null,
    p_location_id: locationId ?? null,
  } as any);

  if (error) {
    // Fallback: if RPC fails, return all as failed
    const results: ReconcileResult[] = items.map(i => ({
      itemId: i.id,
      itemCode: i.item_code,
      action: 'failed' as const,
      message: error.message,
    }));
    return { results, fixed: 0, created: 0, blocked: 0, failed: items.length };
  }

  const results: ReconcileResult[] = (data || []).map((row: any) => ({
    itemId: row.item_id,
    itemCode: row.item_code,
    action: row.action as ReconcileResult['action'],
    message: row.message,
  }));

  return {
    results,
    fixed: results.filter(r => r.action === 'fixed').length,
    created: results.filter(r => r.action === 'created').length,
    blocked: results.filter(r => r.action === 'blocked').length,
    failed: results.filter(r => r.action === 'failed').length,
  };
}
