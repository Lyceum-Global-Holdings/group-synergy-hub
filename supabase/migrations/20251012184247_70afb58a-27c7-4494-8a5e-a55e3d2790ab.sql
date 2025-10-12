-- Update material_issue_notes status constraint to include partially_received and completed
ALTER TABLE material_issue_notes 
DROP CONSTRAINT IF EXISTS material_issue_notes_status_check;

ALTER TABLE material_issue_notes 
ADD CONSTRAINT material_issue_notes_status_check 
CHECK (status IN ('draft', 'approved', 'issued', 'partially_received', 'completed', 'cancelled'));