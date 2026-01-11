-- Drop existing SELECT policy that's too permissive
DROP POLICY IF EXISTS "Users can view POs they created or if admin" ON purchase_orders;

-- Create more restrictive SELECT policy
-- Only allow: admins, the creator, approvers (merchandiser, dept head, final approver)
CREATE POLICY "Restricted PO view access" ON purchase_orders
FOR SELECT USING (
  -- Admins and super admins can view all
  is_admin(auth.uid()) OR is_super_admin(auth.uid())
  -- Creator can view their own POs
  OR auth.uid() = created_by
  -- Approvers can view POs they approved
  OR auth.uid() = approved_by
  OR auth.uid() = merchandiser_approved_by
  OR auth.uid() = department_head_approved_by
  -- Company approvers can view POs in their company
  OR EXISTS (
    SELECT 1 FROM company_approvers ca
    WHERE ca.user_id = auth.uid()
    AND ca.company_id = purchase_orders.company_id
  )
);

-- Also tighten UPDATE policy - remove buyer_id access, keep only creator, approvers, and admins
DROP POLICY IF EXISTS "Users can update their own POs or admins can update any" ON purchase_orders;

CREATE POLICY "Restricted PO update access" ON purchase_orders
FOR UPDATE USING (
  -- Admins can update any
  is_admin(auth.uid()) OR is_super_admin(auth.uid())
  -- Creator can update their own
  OR auth.uid() = created_by
  -- Approvers can update (for approval workflow)
  OR EXISTS (
    SELECT 1 FROM company_approvers ca
    WHERE ca.user_id = auth.uid()
    AND ca.company_id = purchase_orders.company_id
  )
);