-- Add missing foreign key only if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'customer_po_workflow_tracking_stage_completed_by_fkey'
        AND table_name = 'customer_po_workflow_tracking'
    ) THEN
        ALTER TABLE customer_po_workflow_tracking
        ADD CONSTRAINT customer_po_workflow_tracking_stage_completed_by_fkey 
        FOREIGN KEY (stage_completed_by) REFERENCES profiles(user_id) ON DELETE SET NULL;
    END IF;
END $$;

-- Update workflow_stage check constraint to include all valid stages
ALTER TABLE customer_po_workflow_tracking
DROP CONSTRAINT IF EXISTS customer_po_workflow_tracking_workflow_stage_check;

ALTER TABLE customer_po_workflow_tracking
ADD CONSTRAINT customer_po_workflow_tracking_workflow_stage_check 
CHECK (workflow_stage IN (
  'cpo_created',
  'cpo_submitted', 
  'cpo_approved',
  'cpo_rejected',
  'cpo_cancelled',
  'material_demand_planned',
  'pr_created',
  'pr_approved', 
  'po_created',
  'po_approved',
  'delivered',
  'completed'
));