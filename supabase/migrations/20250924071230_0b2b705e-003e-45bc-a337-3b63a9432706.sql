-- Create po_status enum type
CREATE TYPE po_status AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'sent', 'acknowledged', 'partially_received', 'completed', 'cancelled');

-- Drop any existing check constraints on status column that might conflict
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

-- First drop the default constraint
ALTER TABLE purchase_orders ALTER COLUMN status DROP DEFAULT;

-- Update the purchase_orders status column to use the enum
ALTER TABLE purchase_orders 
ALTER COLUMN status TYPE po_status USING status::po_status;

-- Set the new default
ALTER TABLE purchase_orders ALTER COLUMN status SET DEFAULT 'draft'::po_status;

-- Add approved_date to purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS approved_date TIMESTAMP WITH TIME ZONE;

-- Create po_approvals table for tracking approval history
CREATE TABLE IF NOT EXISTS public.po_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL,
  action po_status NOT NULL,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Add constraint to ensure only approval-related actions
  CONSTRAINT po_approvals_action_check CHECK (action IN ('pending_approval', 'approved', 'rejected'))
);

-- Enable RLS on po_approvals
ALTER TABLE public.po_approvals ENABLE ROW LEVEL SECURITY;

-- Create policies for po_approvals
CREATE POLICY "Users can view approvals for POs they have access to" 
ON public.po_approvals 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM purchase_orders po 
    WHERE po.id = po_approvals.po_id 
    AND (po.created_by = auth.uid() OR po.buyer_id = auth.uid() OR is_admin(auth.uid()))
  )
);

CREATE POLICY "Admins can manage all PO approvals" 
ON public.po_approvals 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));