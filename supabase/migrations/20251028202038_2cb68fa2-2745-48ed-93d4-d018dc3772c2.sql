-- Create warehouse stock movements table for audit trail
CREATE TABLE IF NOT EXISTS warehouse_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_item_id uuid NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
  bin_allocation_id uuid REFERENCES warehouse_bin_allocations(id) ON DELETE SET NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('receipt', 'issue', 'adjustment', 'transfer')),
  reference_type text CHECK (reference_type IN ('grn', 'material_issue', 'adjustment', 'transfer')),
  reference_id uuid,
  reference_number text,
  quantity_change numeric(15,2) NOT NULL,
  quantity_before numeric(15,2) NOT NULL,
  quantity_after numeric(15,2) NOT NULL,
  unit_cost numeric(15,2),
  total_value numeric(15,2),
  notes text,
  company_id uuid REFERENCES companies(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for warehouse stock movements
CREATE INDEX idx_warehouse_stock_movements_item ON warehouse_stock_movements(warehouse_item_id);
CREATE INDEX idx_warehouse_stock_movements_reference ON warehouse_stock_movements(reference_type, reference_id);
CREATE INDEX idx_warehouse_stock_movements_created ON warehouse_stock_movements(created_at);

-- Enable RLS on warehouse_stock_movements
ALTER TABLE warehouse_stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies for warehouse_stock_movements
CREATE POLICY "Authenticated users can view stock movements"
  ON warehouse_stock_movements FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can create stock movements"
  ON warehouse_stock_movements FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Add status field to material_issue_notes
ALTER TABLE material_issue_notes
ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'cancelled'));

-- Create function to process material issue stock updates
CREATE OR REPLACE FUNCTION process_material_issue_stock_update(
  p_item_id uuid,
  p_quantity_issued numeric,
  p_bin_allocation_id uuid DEFAULT NULL,
  p_min_id uuid DEFAULT NULL,
  p_min_number text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_warehouse_item RECORD;
  v_bin_allocation RECORD;
BEGIN
  -- 1. Get current warehouse item stock
  SELECT * INTO v_warehouse_item
  FROM warehouse_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse item not found: %', p_item_id;
  END IF;

  -- Check if enough stock available
  IF v_warehouse_item.current_stock < p_quantity_issued THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', 
      v_warehouse_item.current_stock, p_quantity_issued;
  END IF;

  -- 2. Insert stock movement record (before update)
  INSERT INTO warehouse_stock_movements (
    warehouse_item_id,
    bin_allocation_id,
    movement_type,
    reference_type,
    reference_id,
    reference_number,
    quantity_change,
    quantity_before,
    quantity_after,
    notes,
    created_by,
    created_at
  ) VALUES (
    p_item_id,
    p_bin_allocation_id,
    'issue',
    'material_issue',
    p_min_id,
    p_min_number,
    -p_quantity_issued,
    v_warehouse_item.current_stock,
    v_warehouse_item.current_stock - p_quantity_issued,
    'Material issued via MIN: ' || COALESCE(p_min_number, 'Unknown'),
    auth.uid(),
    NOW()
  );

  -- 3. Update warehouse item stock
  UPDATE warehouse_items
  SET 
    current_stock = current_stock - p_quantity_issued,
    reserved_quantity = GREATEST(0, reserved_quantity - p_quantity_issued),
    updated_at = NOW()
  WHERE id = p_item_id;

  -- 4. Update bin allocation if specified
  IF p_bin_allocation_id IS NOT NULL THEN
    SELECT * INTO v_bin_allocation
    FROM warehouse_bin_allocations
    WHERE id = p_bin_allocation_id
    FOR UPDATE;

    IF FOUND THEN
      -- Check if bin has enough quantity
      IF v_bin_allocation.allocated_quantity < p_quantity_issued THEN
        RAISE WARNING 'Bin allocation insufficient. Allocated: %, Requested: %', 
          v_bin_allocation.allocated_quantity, p_quantity_issued;
      END IF;

      UPDATE warehouse_bin_allocations
      SET 
        allocated_quantity = GREATEST(0, allocated_quantity - p_quantity_issued),
        reserved_quantity = GREATEST(0, reserved_quantity - p_quantity_issued),
        available_quantity = GREATEST(0, (allocated_quantity - p_quantity_issued) - (reserved_quantity - p_quantity_issued)),
        updated_at = NOW()
      WHERE id = p_bin_allocation_id;
    END IF;
  END IF;

  -- 5. Log the operation
  RAISE NOTICE 'Stock updated for item %: issued %, new stock: %', 
    p_item_id, p_quantity_issued, v_warehouse_item.current_stock - p_quantity_issued;

END;
$$;

-- Create trigger to set MIN status to 'issued' when items are created
CREATE OR REPLACE FUNCTION set_min_status_to_issued()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE material_issue_notes
  SET status = 'issued', updated_at = NOW()
  WHERE id = NEW.min_id AND status = 'draft';
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_min_status_after_items
AFTER INSERT ON material_issue_items
FOR EACH ROW
EXECUTE FUNCTION set_min_status_to_issued();