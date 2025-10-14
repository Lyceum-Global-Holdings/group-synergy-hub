-- Add acceptance tracking to finished goods issues
ALTER TABLE finished_goods_issues 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES auth.users(id);

-- Update the status check constraint to include 'accepted'
ALTER TABLE finished_goods_issues 
DROP CONSTRAINT IF EXISTS finished_goods_issues_status_check;

ALTER TABLE finished_goods_issues 
ADD CONSTRAINT finished_goods_issues_status_check 
CHECK (status IN ('draft', 'issued', 'accepted', 'cancelled'));

-- Add index for accepted_at
CREATE INDEX IF NOT EXISTS idx_finished_goods_issues_accepted_at 
ON finished_goods_issues(accepted_at);

-- Link delivery orders to finished goods issues
ALTER TABLE delivery_orders 
ADD COLUMN IF NOT EXISTS finished_goods_issue_id UUID REFERENCES finished_goods_issues(id);

-- Add comments for clarity
COMMENT ON COLUMN finished_goods_issues.accepted_at IS 'Timestamp when the issue was accepted for delivery';
COMMENT ON COLUMN finished_goods_issues.accepted_by IS 'User who accepted the issue';
COMMENT ON COLUMN delivery_orders.finished_goods_issue_id IS 'Links delivery order to the finished goods issue';