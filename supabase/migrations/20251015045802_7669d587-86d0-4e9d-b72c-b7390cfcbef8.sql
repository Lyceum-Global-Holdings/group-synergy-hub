-- Add foreign key constraints from goods_receipt_notes to profiles.user_id
-- This allows Supabase PostgREST to properly resolve the relationship

ALTER TABLE goods_receipt_notes
  ADD CONSTRAINT goods_receipt_notes_created_by_profile_fkey 
  FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE SET NULL;

ALTER TABLE goods_receipt_notes
  ADD CONSTRAINT goods_receipt_notes_received_by_profile_fkey 
  FOREIGN KEY (received_by) REFERENCES profiles(user_id) ON DELETE SET NULL;

ALTER TABLE goods_receipt_notes
  ADD CONSTRAINT goods_receipt_notes_approved_by_profile_fkey 
  FOREIGN KEY (approved_by) REFERENCES profiles(user_id) ON DELETE SET NULL;