-- Fix profiles table RLS to restrict visibility to same-company users only

-- Drop the overly permissive admin policy (no company scope)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Add policy for users to view profiles within their own company
CREATE POLICY "Users can view company profiles"
ON public.profiles
FOR SELECT
USING (
  company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
);