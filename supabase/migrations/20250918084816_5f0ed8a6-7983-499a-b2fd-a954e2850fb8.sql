-- Add foreign key constraints to properly link with profiles table
-- First, add foreign key constraints for better relational integrity

ALTER TABLE public.purchase_requisitions 
ADD CONSTRAINT purchase_requisitions_requested_by_fkey 
FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.purchase_requisitions 
ADD CONSTRAINT purchase_requisitions_approved_by_fkey 
FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.pr_approvals 
ADD CONSTRAINT pr_approvals_approver_id_fkey 
FOREIGN KEY (approver_id) REFERENCES auth.users(id) ON DELETE CASCADE;