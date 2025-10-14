-- Add approver_email column to po_approval_tokens table
ALTER TABLE po_approval_tokens 
ADD COLUMN IF NOT EXISTS approver_email text;

-- Make approver_id nullable to support email-only recipients
ALTER TABLE po_approval_tokens 
ALTER COLUMN approver_id DROP NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN po_approval_tokens.approver_email IS 'Email address where the approval request was sent';
COMMENT ON COLUMN po_approval_tokens.approver_id IS 'Optional user ID if the approver has an account in the system';