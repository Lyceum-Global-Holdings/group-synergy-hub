-- Fix security issue: Remove public read access to asset_master table
-- This prevents competitors from accessing sensitive asset information

-- Drop the public access policy
DROP POLICY IF EXISTS "Public can view asset master for requests" ON public.asset_master;

-- The authenticated users policy remains in place:
-- "Authenticated users can view asset master" - SELECT with (auth.uid() IS NOT NULL)
-- This ensures only logged-in users can view asset master data