-- Update RLS policy to allow public inserts for self-service registrations
DROP POLICY IF EXISTS "Users can create registration requests" ON supplier_registration_requests;

CREATE POLICY "Users can create registration requests"
ON supplier_registration_requests FOR INSERT
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = created_by) OR 
  (request_type = 'self_service' AND status = 'pending_approval')
);

-- Allow anonymous users to call check_duplicate_supplier function
GRANT EXECUTE ON FUNCTION check_duplicate_supplier(TEXT, TEXT, TEXT, TEXT) TO anon;