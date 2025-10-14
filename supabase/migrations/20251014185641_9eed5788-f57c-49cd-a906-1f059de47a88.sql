-- Add new enum value for department head approval
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'pending_dept_head_approval';

-- Add approval level tracking
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS approval_level INTEGER DEFAULT 0;

-- Add approval method tracking  
ALTER TABLE po_approvals
ADD COLUMN IF NOT EXISTS approval_method TEXT DEFAULT 'manual';