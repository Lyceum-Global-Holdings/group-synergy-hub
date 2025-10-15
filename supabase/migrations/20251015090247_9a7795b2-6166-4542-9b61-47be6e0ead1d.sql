-- Add 'purchased' status to asset_request_status enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'purchased' AND enumtypid = 'asset_request_status'::regtype) THEN
    ALTER TYPE asset_request_status ADD VALUE 'purchased';
  END IF;
END $$;

-- Add 'items_purchased' to workflow_stage enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'items_purchased' AND enumtypid = 'workflow_stage'::regtype) THEN
    ALTER TYPE workflow_stage ADD VALUE 'items_purchased';
  END IF;
END $$;

-- Add purchase tracking fields to asset_requests table
ALTER TABLE asset_requests
ADD COLUMN IF NOT EXISTS purchased_date DATE,
ADD COLUMN IF NOT EXISTS purchased_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS purchase_notes TEXT;

-- Add source tracking to warehouse_assets table
ALTER TABLE warehouse_assets
ADD COLUMN IF NOT EXISTS source_request_id UUID REFERENCES asset_requests(id),
ADD COLUMN IF NOT EXISTS source_request_number TEXT;

-- Drop and recreate the create_assets_from_request function to add source tracking
DROP FUNCTION IF EXISTS public.create_assets_from_request(uuid);

CREATE OR REPLACE FUNCTION public.create_assets_from_request(p_request_id uuid)
RETURNS TABLE(asset_id uuid, asset_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_request asset_requests%ROWTYPE;
  v_company_id uuid;
  v_main_warehouse_id uuid;
  v_item asset_request_items%ROWTYPE;
  v_asset_master asset_master%ROWTYPE;
  v_new_asset_id uuid;
  v_asset_code text;
  v_counter integer;
BEGIN
  -- Get request details
  SELECT * INTO v_request FROM asset_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset request not found';
  END IF;

  -- Get company's main warehouse
  SELECT main_warehouse_location_id INTO v_main_warehouse_id
  FROM companies
  WHERE id = v_request.company_id;

  IF v_main_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Main warehouse not configured for company';
  END IF;

  -- Loop through approved items
  FOR v_item IN 
    SELECT * FROM asset_request_items 
    WHERE request_id = p_request_id 
    AND status = 'approved'
  LOOP
    -- Get asset master details if from_master
    IF v_item.request_type = 'from_master' AND v_item.asset_master_id IS NOT NULL THEN
      SELECT * INTO v_asset_master FROM asset_master WHERE id = v_item.asset_master_id;
    END IF;

    -- Create assets based on fulfilled quantity
    FOR v_counter IN 1..COALESCE(v_item.quantity_fulfilled, v_item.quantity_approved, 0)
    LOOP
      -- Generate asset code
      v_asset_code := 'AST-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                      LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

      -- Insert new asset
      INSERT INTO warehouse_assets (
        asset_code,
        asset_master_id,
        asset_name,
        brand,
        category_id,
        subcategory_id,
        purchase_price,
        current_value,
        purchase_date,
        depreciation_method,
        depreciation_rate,
        useful_life_years,
        salvage_value,
        status,
        current_location_id,
        current_department_id,
        company_id,
        created_by,
        source_request_id,
        source_request_number
      ) VALUES (
        v_asset_code,
        v_item.asset_master_id,
        COALESCE(v_asset_master.asset_name, v_item.item_name),
        COALESCE(v_asset_master.brand, v_item.brand),
        COALESCE(v_asset_master.category_id, v_item.category_id),
        COALESCE(v_asset_master.subcategory_id, v_item.subcategory_id),
        COALESCE(v_asset_master.purchase_price, v_item.unit_price_estimate),
        COALESCE(v_asset_master.current_value, v_item.unit_price_estimate),
        COALESCE(v_asset_master.purchase_date, CURRENT_DATE),
        v_asset_master.depreciation_method,
        v_asset_master.depreciation_rate,
        v_asset_master.useful_life_years,
        v_asset_master.salvage_value,
        'available',
        v_main_warehouse_id,
        NULL,
        v_request.company_id,
        v_request.created_by,
        p_request_id,
        v_request.request_number
      )
      RETURNING id INTO v_new_asset_id;

      -- Return the created asset details
      asset_id := v_new_asset_id;
      asset_code := v_asset_code;
      RETURN NEXT;
    END LOOP;
  END LOOP;
END;
$function$;