-- Drop all policies that depend on status column
DROP POLICY IF EXISTS "Users can update their own draft requests or admins can update " ON material_requests;
DROP POLICY IF EXISTS "Users can manage items for their own draft requests" ON material_request_items;

-- Create material request enums
DO $$ BEGIN
  CREATE TYPE material_request_status AS ENUM (
    'draft',
    'pending_hod_approval',
    'pending_management_approval',
    'approved',
    'rejected',
    'cancelled',
    'issued',
    'partially_received',
    'completed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE material_request_priority AS ENUM (
    'low',
    'normal',
    'medium',
    'high',
    'urgent'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Convert columns to enum types
ALTER TABLE material_requests ALTER COLUMN status DROP DEFAULT;
ALTER TABLE material_requests ALTER COLUMN status TYPE material_request_status USING status::material_request_status;
ALTER TABLE material_requests ALTER COLUMN status SET DEFAULT 'draft'::material_request_status;

ALTER TABLE material_requests ALTER COLUMN priority DROP DEFAULT;
ALTER TABLE material_requests ALTER COLUMN priority TYPE material_request_priority USING priority::material_request_priority;
ALTER TABLE material_requests ALTER COLUMN priority SET DEFAULT 'medium'::material_request_priority;

-- Recreate policies with correct types
CREATE POLICY "Users can update their own draft requests or admins can update" ON material_requests
FOR UPDATE USING (
  ((auth.uid() = created_by) AND (status = 'draft'::material_request_status)) 
  OR is_admin(auth.uid())
);

CREATE POLICY "Users can manage items for their own draft requests" ON material_request_items
FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM material_requests mr
    WHERE (mr.id = material_request_items.request_id) 
      AND (((mr.created_by = auth.uid()) AND (mr.status = 'draft'::material_request_status)) 
      OR is_admin(auth.uid()))
  )
);

-- Add tracking columns
ALTER TABLE material_request_items
ADD COLUMN IF NOT EXISTS quantity_issued numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_received numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS issued_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS received_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS received_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS adjustment_reason text;

-- Create auto-update function
CREATE OR REPLACE FUNCTION public.update_material_request_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_items integer;
  fully_received_items integer;
  partially_received_items integer;
  issued_items integer;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE quantity_received > 0 AND quantity_received >= quantity_issued),
    COUNT(*) FILTER (WHERE quantity_received > 0 AND quantity_received < quantity_issued),
    COUNT(*) FILTER (WHERE quantity_issued > 0)
  INTO total_items, fully_received_items, partially_received_items, issued_items
  FROM material_request_items
  WHERE request_id = NEW.request_id;
  
  UPDATE material_requests
  SET 
    status = CASE
      WHEN fully_received_items = total_items AND total_items > 0 THEN 'completed'::material_request_status
      WHEN (fully_received_items + partially_received_items) > 0 THEN 'partially_received'::material_request_status
      WHEN issued_items > 0 AND (fully_received_items + partially_received_items) = 0 THEN 'issued'::material_request_status
      ELSE status
    END,
    updated_at = now()
  WHERE id = NEW.request_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_material_request_status ON material_request_items;
CREATE TRIGGER trigger_update_material_request_status
AFTER INSERT OR UPDATE OF quantity_issued, quantity_received ON material_request_items
FOR EACH ROW
EXECUTE FUNCTION public.update_material_request_status();

-- Add constraint
ALTER TABLE material_request_items
DROP CONSTRAINT IF EXISTS check_received_lte_issued;
ALTER TABLE material_request_items
ADD CONSTRAINT check_received_lte_issued 
CHECK (quantity_received <= quantity_issued OR quantity_issued = 0);