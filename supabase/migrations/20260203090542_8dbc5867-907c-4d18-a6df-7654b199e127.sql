-- Fix journal_entries table public exposure
-- Revoke all anonymous access to journal_entries table

REVOKE ALL ON public.journal_entries FROM anon;

-- Ensure only authenticated users can access journal_entries
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;

-- Force RLS for table owner as well (extra security)
ALTER TABLE public.journal_entries FORCE ROW LEVEL SECURITY;