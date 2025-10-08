-- Add approval columns to finished_goods_batches table
ALTER TABLE finished_goods_batches
ADD COLUMN approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN approved_by uuid REFERENCES auth.users(id),
ADD COLUMN approved_date timestamp with time zone,
ADD COLUMN approval_comments text,
ADD COLUMN rejection_reason text;

-- Create finished_goods_batch_approvals audit table
CREATE TABLE finished_goods_batch_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES finished_goods_batches(id) ON DELETE CASCADE NOT NULL,
  approver_id uuid REFERENCES auth.users(id) NOT NULL,
  action text NOT NULL CHECK (action IN ('approved', 'rejected', 'revision_requested')),
  comments text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on new table
ALTER TABLE finished_goods_batch_approvals ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view approval history
CREATE POLICY "Authenticated users can view approval history"
ON finished_goods_batch_approvals FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Only admins can insert approval records
CREATE POLICY "Admins can create approval records"
ON finished_goods_batch_approvals FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- Allow admins to approve/reject batches
CREATE POLICY "Admins can update batch approval status"
ON finished_goods_batches FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()) OR (auth.uid() = created_by AND approval_status = 'pending'));

-- Create trigger to update stock only on approval
CREATE OR REPLACE FUNCTION update_stock_on_batch_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create stock movement when status changes to 'approved'
  IF NEW.approval_status = 'approved' AND 
     (OLD.approval_status IS NULL OR OLD.approval_status != 'approved') THEN
    
    -- Insert stock movement
    INSERT INTO finished_goods_movements (
      finished_good_id,
      batch_id,
      movement_type,
      reference_type,
      reference_id,
      quantity_change,
      quantity_before,
      quantity_after,
      unit_cost,
      total_value,
      notes,
      company_id,
      created_by
    )
    SELECT 
      NEW.finished_good_id,
      NEW.id,
      'production_receipt',
      'batch',
      NEW.id,
      NEW.quantity,
      COALESCE(fg.current_stock, 0),
      COALESCE(fg.current_stock, 0) + NEW.quantity,
      CASE WHEN NEW.quantity > 0 THEN NEW.production_cost / NEW.quantity ELSE 0 END,
      NEW.production_cost,
      'Production batch approved: ' || NEW.batch_number,
      NEW.company_id,
      NEW.approved_by
    FROM finished_goods fg
    WHERE fg.id = NEW.finished_good_id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_stock_on_batch_approval
AFTER UPDATE ON finished_goods_batches
FOR EACH ROW
EXECUTE FUNCTION update_stock_on_batch_approval();