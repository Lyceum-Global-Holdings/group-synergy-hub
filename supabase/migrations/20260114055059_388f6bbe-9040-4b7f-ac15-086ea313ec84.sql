-- Create junction table for user company access
CREATE TABLE public.user_company_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL DEFAULT 'full',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(user_id, company_id)
);

-- Enable RLS
ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admins can manage all user company access
CREATE POLICY "Admins can manage user company access"
  ON public.user_company_access FOR ALL
  USING (is_admin(auth.uid()));

-- Users can view their own company access
CREATE POLICY "Users can view their own company access"
  ON public.user_company_access FOR SELECT
  USING (user_id = auth.uid());

-- Create helper function to check if user has access to a specific company
CREATE OR REPLACE FUNCTION public.user_has_company_access(
  _user_id UUID,
  _company_id UUID
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_company_access
    WHERE user_id = _user_id AND company_id = _company_id
  ) OR EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = _user_id AND company_id = _company_id
  );
$$;