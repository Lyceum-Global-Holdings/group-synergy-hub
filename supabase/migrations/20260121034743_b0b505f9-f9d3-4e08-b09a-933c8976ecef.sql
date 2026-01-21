-- Fix asset_requests table RLS policies to restrict access properly

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own requests" ON public.asset_requests;
DROP POLICY IF EXISTS "Users can create asset requests" ON public.asset_requests;
DROP POLICY IF EXISTS "Users can update their own draft requests" ON public.asset_requests;
DROP POLICY IF EXISTS "Users can delete their own draft requests" ON public.asset_requests;

-- SELECT: Users can view requests they created, are assigned to approve, or are admins in their company
CREATE POLICY "Users can view asset requests"
ON public.asset_requests FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (
      -- Requester can view their own requests
      auth.uid() = created_by OR 
      auth.uid() = requested_by OR
      -- HOD approver can view
      auth.uid() = hod_approved_by OR
      -- Procurement approver can view
      auth.uid() = procurement_approved_by OR
      -- Fulfiller can view
      auth.uid() = fulfilled_by OR
      -- Purchaser can view
      auth.uid() = purchased_by OR
      -- Admins and managers can view all in their company
      is_admin(auth.uid()) OR 
      has_manager_access(auth.uid()) OR
      has_procurement_access(auth.uid())
    )
  )
);

-- INSERT: Users can create requests within their company
CREATE POLICY "Users can create asset requests"
ON public.asset_requests FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    auth.uid() = created_by
  )
);

-- UPDATE: Requester can update drafts, approvers/admins can update during workflow
CREATE POLICY "Users can update asset requests"
ON public.asset_requests FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (
      -- Requester can update their own drafts
      (auth.uid() = created_by AND status = 'draft') OR
      -- Admins can update any request in their company
      is_admin(auth.uid()) OR
      -- Managers can update for approval workflow
      has_manager_access(auth.uid()) OR
      -- Procurement can update during their approval stage
      has_procurement_access(auth.uid())
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (
      (auth.uid() = created_by AND status = 'draft') OR
      is_admin(auth.uid()) OR
      has_manager_access(auth.uid()) OR
      has_procurement_access(auth.uid())
    )
  )
);

-- DELETE: Only requester can delete their own drafts, or admins
CREATE POLICY "Users can delete asset requests"
ON public.asset_requests FOR DELETE
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  (
    can_access_company(company_id) AND 
    (
      (auth.uid() = created_by AND status = 'draft') OR
      is_admin(auth.uid())
    )
  )
);