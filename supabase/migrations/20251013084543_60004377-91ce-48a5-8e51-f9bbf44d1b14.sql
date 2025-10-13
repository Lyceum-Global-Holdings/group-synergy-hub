-- Update RLS policy to allow public asset request submissions
DROP POLICY IF EXISTS "Users can create asset requests" ON asset_requests;

CREATE POLICY "Users can create asset requests" ON asset_requests
FOR INSERT 
WITH CHECK (
  -- Allow authenticated users to create with their ID
  (auth.uid() IS NOT NULL AND auth.uid() = created_by)
  OR
  -- Allow public submissions (created_by and requested_by are NULL)
  (created_by IS NULL AND requested_by IS NULL)
);

-- Update RLS policy for asset_request_items to allow public requests
DROP POLICY IF EXISTS "Users can manage items for their requests" ON asset_request_items;

CREATE POLICY "Users can manage items for their requests" ON asset_request_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM asset_requests
    WHERE asset_requests.id = asset_request_items.request_id
    AND (
      -- Owner can manage items in draft
      ((auth.uid() = asset_requests.created_by) AND asset_requests.status = 'draft')
      OR
      -- Admins can manage all
      is_admin(auth.uid())
      OR
      -- Allow for public requests during creation
      (asset_requests.created_by IS NULL AND asset_requests.requested_by IS NULL)
    )
  )
);

-- Update view policy for asset_request_items
DROP POLICY IF EXISTS "Users can view items for accessible requests" ON asset_request_items;

CREATE POLICY "Users can view items for accessible requests" ON asset_request_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM asset_requests
    WHERE asset_requests.id = asset_request_items.request_id
    AND (
      auth.uid() = asset_requests.created_by
      OR auth.uid() = asset_requests.requested_by
      OR is_admin(auth.uid())
      OR (asset_requests.created_by IS NULL AND asset_requests.requested_by IS NULL)
    )
  )
);

-- Update view policy for asset_requests to include public requests for admins
DROP POLICY IF EXISTS "Users can view their own requests" ON asset_requests;

CREATE POLICY "Users can view their own requests" ON asset_requests
FOR SELECT
USING (
  (auth.uid() IS NOT NULL)
  AND (
    auth.uid() = created_by
    OR auth.uid() = requested_by
    OR is_admin(auth.uid())
  )
);