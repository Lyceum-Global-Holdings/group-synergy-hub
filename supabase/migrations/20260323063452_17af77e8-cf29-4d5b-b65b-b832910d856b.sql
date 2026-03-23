
create or replace function public.reconcile_stock_batch(
  p_item_ids uuid[],
  p_company_id uuid,
  p_overrides jsonb default '{}'::jsonb,
  p_user_id uuid default null
)
returns table(item_id uuid, item_code text, action text, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_item_code text;
  v_current_stock numeric;
  v_location_id uuid;
  v_alloc_total numeric;
  v_alloc_count int;
  v_primary_alloc_id uuid;
  v_primary_alloc_qty numeric;
  v_primary_reserved numeric;
  v_other_total numeric;
  v_new_qty numeric;
  v_new_reserved numeric;
  v_override jsonb;
  v_override_location_id uuid;
  v_override_bin_id uuid;
  v_effective_location uuid;
  v_target_bin_id uuid;
begin
  foreach v_item_id in array p_item_ids loop
    -- Reset
    item_id := v_item_id;
    
    -- 1. Load item
    select wi.item_code, coalesce(wi.current_stock, 0), wi.location_id
    into v_item_code, v_current_stock, v_location_id
    from warehouse_items wi
    where wi.id = v_item_id;
    
    if not found then
      item_code := 'UNKNOWN';
      action := 'failed';
      message := 'Item not found';
      return next;
      continue;
    end if;
    
    item_code := v_item_code;
    
    -- 2. Check overrides
    v_override := p_overrides -> v_item_id::text;
    v_override_location_id := null;
    v_override_bin_id := null;
    if v_override is not null then
      v_override_location_id := (v_override ->> 'locationId')::uuid;
      v_override_bin_id := (v_override ->> 'binId')::uuid;
    end if;
    
    v_effective_location := coalesce(v_override_location_id, v_location_id);
    
    -- 3. Sum existing allocations for this item+company
    select count(*), coalesce(sum(allocated_quantity), 0)
    into v_alloc_count, v_alloc_total
    from warehouse_bin_allocations
    where warehouse_item_id = v_item_id
      and company_id = p_company_id;
    
    -- 4a. No allocations exist → create one
    if v_alloc_count = 0 then
      if v_current_stock = 0 then
        action := 'fixed';
        message := 'Zero stock, no allocation needed';
        return next;
        continue;
      end if;
      
      -- Determine target bin
      v_target_bin_id := v_override_bin_id;
      if v_target_bin_id is null and v_effective_location is not null then
        select wb.id into v_target_bin_id
        from warehouse_bins wb
        where wb.location_id = v_effective_location
          and wb.status = 'active'
        order by wb.bin_code asc
        limit 1;
      end if;
      
      if v_target_bin_id is null then
        action := 'blocked';
        message := 'No location/bin available';
        return next;
        continue;
      end if;
      
      insert into warehouse_bin_allocations (
        warehouse_item_id, bin_id, allocated_quantity, reserved_quantity,
        company_id, created_by
      ) values (
        v_item_id, v_target_bin_id, v_current_stock, 0,
        p_company_id, p_user_id
      );
      
      -- Update item location if it was null and we used an override
      if v_location_id is null and v_override_location_id is not null then
        update warehouse_items set location_id = v_override_location_id where id = v_item_id;
      end if;
      
      action := 'created';
      message := 'Bin allocation created';
      return next;
      continue;
    end if;
    
    -- 4b. Allocations exist → check if in sync
    if abs(v_current_stock - v_alloc_total) < 0.001 then
      action := 'fixed';
      message := 'Already in sync';
      return next;
      continue;
    end if;
    
    -- Find primary allocation to adjust (prefer location-matching, else largest)
    if v_effective_location is not null then
      select ba.id, ba.allocated_quantity, coalesce(ba.reserved_quantity, 0)
      into v_primary_alloc_id, v_primary_alloc_qty, v_primary_reserved
      from warehouse_bin_allocations ba
      join warehouse_bins wb on wb.id = ba.bin_id
      where ba.warehouse_item_id = v_item_id
        and ba.company_id = p_company_id
        and wb.location_id = v_effective_location
      order by ba.allocated_quantity desc
      limit 1;
    end if;
    
    -- Fallback: use largest allocation regardless of location
    if v_primary_alloc_id is null then
      select ba.id, ba.allocated_quantity, coalesce(ba.reserved_quantity, 0)
      into v_primary_alloc_id, v_primary_alloc_qty, v_primary_reserved
      from warehouse_bin_allocations ba
      where ba.warehouse_item_id = v_item_id
        and ba.company_id = p_company_id
      order by ba.allocated_quantity desc
      limit 1;
    end if;
    
    -- Calculate adjustment
    v_other_total := v_alloc_total - v_primary_alloc_qty;
    v_new_qty := greatest(0, v_current_stock - v_other_total);
    v_new_reserved := least(v_primary_reserved, v_new_qty);
    
    update warehouse_bin_allocations
    set allocated_quantity = v_new_qty,
        reserved_quantity = v_new_reserved,
        updated_at = now()
    where id = v_primary_alloc_id;
    
    action := 'fixed';
    message := 'Allocation adjusted';
    return next;
  end loop;
end;
$$;
