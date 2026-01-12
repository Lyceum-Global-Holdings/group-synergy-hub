-- Fix overly permissive RLS policy on tool_adjustments table
-- Drop the permissive policy
DROP POLICY IF EXISTS "Users can manage tool adjustments" ON public.tool_adjustments;

-- Create proper policies that require authentication
CREATE POLICY "Authenticated users can view tool adjustments"
ON public.tool_adjustments
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert tool adjustments"
ON public.tool_adjustments
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update tool adjustments"
ON public.tool_adjustments
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete tool adjustments"
ON public.tool_adjustments
FOR DELETE
USING (auth.uid() IS NOT NULL);