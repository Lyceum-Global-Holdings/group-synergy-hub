-- First check what constraints exist on customer_po_approvals
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'customer_po_approvals' AND table_schema = 'public';

-- Then create the proper foreign key relationship
ALTER TABLE customer_po_approvals 
DROP CONSTRAINT IF EXISTS customer_po_approvals_approver_id_fkey;

ALTER TABLE customer_po_approvals 
ADD CONSTRAINT customer_po_approvals_approver_id_fkey 
FOREIGN KEY (approver_id) REFERENCES profiles(user_id) ON DELETE CASCADE;