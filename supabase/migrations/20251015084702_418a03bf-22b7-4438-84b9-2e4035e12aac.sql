-- Phase 2: Fix Asset Request Schema for Department Support

-- Add department_id UUID field to asset_requests
ALTER TABLE asset_requests 
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES warehouse_locations(id);

-- Add comment to explain the field usage
COMMENT ON COLUMN asset_requests.department_id IS 'UUID reference to warehouse_locations (department) for asset delivery';
COMMENT ON COLUMN asset_requests.department IS 'Text display name of department (kept for compatibility)';

-- Drop and recreate the transfer_assets_to_department function with proper return type
DROP FUNCTION IF EXISTS transfer_assets_to_department(UUID);

CREATE FUNCTION transfer_assets_to_department(
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_record RECORD;
  v_department_id UUID;
  v_department_name TEXT;
  v_assets_updated INTEGER := 0;
  v_result JSONB;
BEGIN
  -- Get request details including department
  SELECT 
    ar.id,
    ar.department_id,
    ar.department,
    ar.company_id
  INTO v_request_record
  FROM asset_requests ar
  WHERE ar.id = p_request_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Request not found'
    );
  END IF;
  
  -- Use department_id if available, otherwise try to find by name
  v_department_id := v_request_record.department_id;
  
  IF v_department_id IS NULL AND v_request_record.department IS NOT NULL THEN
    -- Try to find department by name
    SELECT id INTO v_department_id
    FROM warehouse_locations
    WHERE name = v_request_record.department
    AND company_id = v_request_record.company_id
    AND warehouse_category = 'department'
    LIMIT 1;
  END IF;
  
  IF v_department_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Department location not found. Please configure department in Location Management.'
    );
  END IF;
  
  -- Update all assets created from this request
  UPDATE warehouse_assets
  SET 
    location_id = v_department_id,
    status = 'in_use',
    updated_at = NOW()
  WHERE id IN (
    SELECT wa.id
    FROM warehouse_assets wa
    JOIN asset_request_items ari ON ari.id = wa.asset_request_item_id
    WHERE ari.request_id = p_request_id
    AND wa.status = 'available'  -- Only transfer assets that haven't been transferred yet
  );
  
  GET DIAGNOSTICS v_assets_updated = ROW_COUNT;
  
  -- Create asset transfer records
  INSERT INTO asset_transfers (
    asset_id,
    from_location_id,
    to_location_id,
    transfer_date,
    transfer_reason,
    transferred_by,
    notes
  )
  SELECT 
    wa.id,
    c.main_warehouse_location_id,
    v_department_id,
    CURRENT_DATE,
    'Asset request fulfillment',
    ar.requested_by,
    'Transferred to ' || COALESCE(wl.name, v_request_record.department, 'department') || ' for request ' || ar.request_number
  FROM warehouse_assets wa
  JOIN asset_request_items ari ON ari.id = wa.asset_request_item_id
  JOIN asset_requests ar ON ar.id = ari.request_id
  JOIN companies c ON c.id = ar.company_id
  LEFT JOIN warehouse_locations wl ON wl.id = v_department_id
  WHERE ari.request_id = p_request_id
  AND wa.status = 'in_use';  -- Only create transfers for assets we just updated
  
  -- Update request status to fulfilled
  UPDATE asset_requests
  SET 
    status = 'fulfilled',
    fulfilled_date = CURRENT_DATE,
    fulfilled_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_request_id;
  
  -- Create workflow history entry
  INSERT INTO asset_request_workflow_history (
    request_id,
    workflow_stage,
    performed_by,
    comments,
    metadata
  )
  VALUES (
    p_request_id,
    'assets_transferred',
    auth.uid(),
    'Assets transferred to department',
    jsonb_build_object(
      'assets_transferred', v_assets_updated,
      'department_id', v_department_id,
      'department_name', COALESCE(
        (SELECT name FROM warehouse_locations WHERE id = v_department_id),
        v_request_record.department
      )
    )
  );
  
  v_result := jsonb_build_object(
    'success', true,
    'assets_transferred', v_assets_updated,
    'department_id', v_department_id,
    'message', 'Successfully transferred ' || v_assets_updated || ' assets to department'
  );
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;