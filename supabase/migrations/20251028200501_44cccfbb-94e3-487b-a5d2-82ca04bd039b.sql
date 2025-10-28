-- Phase 1: Add CPO and reservation linkage to material issue tables

-- Add CPO reference to material issue notes
ALTER TABLE material_issue_notes
ADD COLUMN cpo_id uuid REFERENCES customer_purchase_orders(id),
ADD COLUMN cpo_number text;

-- Add reservation tracking to material issue items
ALTER TABLE material_issue_items
ADD COLUMN reservation_id uuid REFERENCES warehouse_item_reservations(id),
ADD COLUMN from_reservation boolean DEFAULT false;

-- Create indexes for performance
CREATE INDEX idx_material_issue_notes_cpo_id ON material_issue_notes(cpo_id);
CREATE INDEX idx_material_issue_items_reservation_id ON material_issue_items(reservation_id);

-- Phase 3: Create RPC function to update reservation when materials are issued
CREATE OR REPLACE FUNCTION update_reservation_on_issue(
  p_reservation_id uuid,
  p_quantity_issued numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reservation warehouse_item_reservations%ROWTYPE;
  v_new_quantity_issued numeric;
  v_new_quantity_remaining numeric;
  v_new_status text;
BEGIN
  -- Get current reservation
  SELECT * INTO v_reservation
  FROM warehouse_item_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
  END IF;

  -- Calculate new quantities
  v_new_quantity_issued := v_reservation.quantity_issued + p_quantity_issued;
  v_new_quantity_remaining := v_reservation.reserved_quantity - v_new_quantity_issued;

  -- Determine new status
  IF v_new_quantity_issued >= v_reservation.reserved_quantity THEN
    v_new_status := 'issued';
  ELSIF v_new_quantity_issued > 0 THEN
    v_new_status := 'partially_issued';
  ELSE
    v_new_status := v_reservation.status;
  END IF;

  -- Update reservation
  UPDATE warehouse_item_reservations
  SET 
    quantity_issued = v_new_quantity_issued,
    quantity_remaining = v_new_quantity_remaining,
    status = v_new_status::reservation_status,
    updated_at = NOW()
  WHERE id = p_reservation_id;

  -- Update warehouse_items reserved_quantity
  UPDATE warehouse_items
  SET reserved_quantity = (
    SELECT COALESCE(SUM(quantity_remaining), 0)
    FROM warehouse_item_reservations
    WHERE warehouse_item_id = v_reservation.warehouse_item_id
    AND status IN ('active', 'partially_issued')
  ),
  updated_at = NOW()
  WHERE id = v_reservation.warehouse_item_id;
END;
$$;