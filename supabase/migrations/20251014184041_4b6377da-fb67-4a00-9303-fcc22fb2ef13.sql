-- Add approval fields to purchase_orders table
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS merchandiser_approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS merchandiser_approved_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS merchandiser_comments TEXT,
ADD COLUMN IF NOT EXISTS department_head_approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS department_head_approved_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS department_head_comments TEXT,
ADD COLUMN IF NOT EXISTS approval_level INTEGER DEFAULT 0;

-- Add approval level and method tracking to po_approvals
ALTER TABLE po_approvals
ADD COLUMN IF NOT EXISTS approval_level TEXT CHECK (approval_level IN ('merchandiser', 'department_head')),
ADD COLUMN IF NOT EXISTS approval_method TEXT DEFAULT 'manual' CHECK (approval_method IN ('manual', 'email'));

-- Create po_approval_tokens table for email-based approvals
CREATE TABLE IF NOT EXISTS po_approval_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  approver_id UUID NOT NULL REFERENCES auth.users(id),
  approval_level TEXT NOT NULL CHECK (approval_level IN ('merchandiser', 'department_head')),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_po_approval_tokens_token ON po_approval_tokens(token);
CREATE INDEX IF NOT EXISTS idx_po_approval_tokens_po_id ON po_approval_tokens(po_id);
CREATE INDEX IF NOT EXISTS idx_po_approval_tokens_approver ON po_approval_tokens(approver_id);

-- Enable RLS on po_approval_tokens
ALTER TABLE po_approval_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for po_approval_tokens
CREATE POLICY "Admins can manage approval tokens"
ON po_approval_tokens
FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own approval tokens"
ON po_approval_tokens
FOR SELECT
USING (auth.uid() = approver_id);

-- Create helper function to check PO approval roles
CREATE OR REPLACE FUNCTION has_po_approval_role(_user_id UUID, _role_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = _user_id
      AND r.name = _role_name
  )
$$;

-- Insert approval roles if they don't exist
INSERT INTO roles (name, description, department, app_role)
VALUES 
  ('Merchandiser', 'Merchandiser role for PO approval', 'Procurement', 'user'),
  ('Department Head', 'Department Head role for final PO approval', 'Procurement', 'admin')
ON CONFLICT (name) DO NOTHING;