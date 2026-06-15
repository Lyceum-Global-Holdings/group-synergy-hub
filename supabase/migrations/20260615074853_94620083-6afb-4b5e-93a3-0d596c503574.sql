ALTER TABLE public.material_issue_notes DROP CONSTRAINT IF EXISTS material_issue_notes_status_check;
ALTER TABLE public.material_issue_notes ADD CONSTRAINT material_issue_notes_status_check
  CHECK (status = ANY (ARRAY['draft','pending_approval','approved','rejected','issued','partially_received','completed','cancelled']));