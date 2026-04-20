-- Remove the overly permissive SELECT policy that grants all authenticated users access
DROP POLICY IF EXISTS "Users can view construction documents" ON public.construction_documents;