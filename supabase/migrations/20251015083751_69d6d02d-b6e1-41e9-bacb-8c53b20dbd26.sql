-- Phase 2: Backend Functions for Asset Purchase and Transfer Workflow (Fixed)

-- 2.1 Drop and recreate create_assets_from_request function with new logic
DROP FUNCTION IF EXISTS public.create_assets_from_request(uuid);

CREATE OR REPLACE FUNCTION public.create_assets_from_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_asset_master_id UUID;
  v_request RECORD;
  v_counter INTEGER;
  v_main_warehouse_location_id UUID;
BEGIN
  -- Get request details
  SELECT * INTO v_request FROM public.asset_requests WHERE id = p_request_id;
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Asset request not found'; 
  END IF;
  
  -- Get main warehouse location from company
  SELECT main_warehouse_location_id 
  INTO v_main_warehouse_location_id
  FROM public.companies 
  WHERE id = v_request.company_id;
  
  IF v_main_warehouse_location_id IS NULL THEN
    RAISE EXCEPTION 'Main warehouse location not configured for this company. Please configure it in company settings.';
  END IF;
  
  -- Process each item in the request
  FOR v_item IN 
    SELECT * 
    FROM public.asset_request_items 
    WHERE request_id = p_request_id 
    AND quantity_fulfilled > 0
  LOOP
    -- If asset master exists, create multiple assets
    IF v_item.asset_master_id IS NOT NULL THEN
      v_counter := 1;
      WHILE v_counter <= v_item.quantity_fulfilled LOOP
        INSERT INTO public.warehouse_assets (
          asset_master_id, 
          asset_tag, 
          status, 
          location_id,
          department_id,
          notes, 
          company_id, 
          created_by
        )
        VALUES (
          v_item.asset_master_id, 
          'AR-' || v_request.request_number || '-' || v_counter, 
          'available',
          v_main_warehouse_location_id,
          NULL,
          'Purchased via Asset Request: ' || v_request.request_number || ' - Awaiting department transfer', 
          v_request.company_id, 
          v_request.fulfilled_by
        );
        v_counter := v_counter + 1;
      END LOOP;
    ELSE
      -- Create new asset master for new items
      INSERT INTO public.asset_master (
        asset_name, 
        description, 
        brand, 
        category_id, 
        company_id, 
        created_by, 
        status
      )
      VALUES (
        v_item.item_name, 
        v_item.item_description, 
        v_item.brand, 
        v_item.category_id, 
        v_request.company_id, 
        v_request.fulfilled_by, 
        'active'
      )
      RETURNING id INTO v_asset_master_id;
      
      -- Create multiple assets for the new asset master
      v_counter := 1;
      WHILE v_counter <= v_item.quantity_fulfilled LOOP
        INSERT INTO public.warehouse_assets (
          asset_master_id, 
          asset_tag, 
          status, 
          location_id,
          department_id,
          notes, 
          company_id, 
          created_by
        )
        VALUES (
          v_asset_master_id, 
          'AR-' || v_request.request_number || '-NEW-' || v_counter, 
          'available',
          v_main_warehouse_location_id,
          NULL,
          'New asset purchased via request: ' || v_request.request_number || ' - Awaiting department transfer', 
          v_request.company_id, 
          v_request.fulfilled_by
        );
        v_counter := v_counter + 1;
      END LOOP;
    END IF;
  END LOOP;
  
  -- Update request status to purchased
  UPDATE public.asset_requests
  SET status = 'purchased',
      updated_at = NOW()
  WHERE id = p_request_id;
  
  -- Update all items status to purchased
  UPDATE public.asset_request_items
  SET status = 'purchased',
      updated_at = NOW()
  WHERE request_id = p_request_id
  AND quantity_fulfilled > 0;
  
  -- Record workflow action
  INSERT INTO public.asset_request_workflow_history (
    request_id,
    workflow_stage,
    performed_by,
    comments,
    metadata
  )
  VALUES (
    p_request_id,
    'purchased',
    v_request.fulfilled_by,
    'Assets created in main warehouse',
    jsonb_build_object(
      'auto_created', true, 
      'location_id', v_main_warehouse_location_id,
      'total_items', (SELECT COUNT(*) FROM public.asset_request_items WHERE request_id = p_request_id AND quantity_fulfilled > 0)
    )
  );
END;
$function$;

COMMENT ON FUNCTION public.create_assets_from_request(uuid) IS 'Creates warehouse assets in main warehouse location from approved asset request items';

-- 2.2 Create transfer_assets_to_department function
CREATE OR REPLACE FUNCTION public.transfer_assets_to_department(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_request RECORD;
  v_asset RECORD;
  v_transfer_count INTEGER := 0;
BEGIN
  -- Get request details
  SELECT * INTO v_request FROM public.asset_requests WHERE id = p_request_id;
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Asset request not found'; 
  END IF;
  
  IF v_request.department IS NULL THEN
    RAISE EXCEPTION 'Request does not have a department specified';
  END IF;
  
  -- Find and transfer all assets created from this request
  FOR v_asset IN 
    SELECT wa.id, wa.location_id, wa.asset_tag
    FROM public.warehouse_assets wa
    WHERE wa.notes LIKE '%Asset Request: ' || v_request.request_number || '%'
    AND wa.company_id = v_request.company_id
    AND wa.department_id IS NULL
    AND wa.status = 'available'
  LOOP
    -- Create transfer record
    INSERT INTO public.asset_transfers (
      asset_id,
      from_location_id,
      to_location_id,
      to_department_id,
      transfer_date,
      transferred_by,
      transfer_reason,
      notes
    )
    VALUES (
      v_asset.id,
      v_asset.location_id,
      v_asset.location_id,
      v_request.department,
      CURRENT_DATE,
      COALESCE(v_request.fulfilled_by, auth.uid()),
      'Asset Request Fulfillment',
      'Transferred to department for request: ' || v_request.request_number || ' - Asset: ' || v_asset.asset_tag
    );
    
    -- Update asset with department and change status to in_use
    UPDATE public.warehouse_assets
    SET 
      department_id = v_request.department,
      status = 'in_use',
      updated_at = NOW()
    WHERE id = v_asset.id;
    
    v_transfer_count := v_transfer_count + 1;
  END LOOP;
  
  -- Only record workflow if assets were transferred
  IF v_transfer_count > 0 THEN
    -- Record workflow action
    INSERT INTO public.asset_request_workflow_history (
      request_id,
      workflow_stage,
      performed_by,
      comments,
      metadata
    )
    VALUES (
      p_request_id,
      'fulfilled',
      COALESCE(v_request.fulfilled_by, auth.uid()),
      'Assets transferred to department',
      jsonb_build_object(
        'department_id', v_request.department,
        'assets_transferred', v_transfer_count
      )
    );
    
    -- Update request status to fulfilled
    UPDATE public.asset_requests
    SET 
      status = 'fulfilled',
      fulfilled_date = CURRENT_DATE,
      updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Update items status to fulfilled
    UPDATE public.asset_request_items
    SET status = 'fulfilled',
        updated_at = NOW()
    WHERE request_id = p_request_id
    AND status = 'delivered';
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.transfer_assets_to_department(uuid) IS 'Transfers assets from main warehouse to department and updates request status to fulfilled';