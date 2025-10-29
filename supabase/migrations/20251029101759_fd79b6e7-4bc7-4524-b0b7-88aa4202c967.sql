-- Fix security vulnerability: Remove public access to asset_categories
-- This prevents competitors from viewing your asset classification structure

-- Drop the overly permissive public access policy
DROP POLICY IF EXISTS "Public can view asset categories for requests" ON asset_categories;

-- The existing "Authenticated users can view asset categories" policy already provides
-- proper authenticated access, so no additional policy is needed.

-- If the public-asset-request edge function needs access to categories,
-- it should be handled server-side within the function using the service role key,
-- not through public RLS policies.