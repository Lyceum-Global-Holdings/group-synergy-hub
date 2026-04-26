-- User-scoped sidebar pins per company
CREATE TABLE public.user_pinned_submodules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  submodule_key text NOT NULL,
  submodule_url text NOT NULL,
  submodule_title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_pinned_submodules_unique UNIQUE (user_id, company_id, module_key, submodule_key)
);

CREATE INDEX idx_user_pinned_submodules_user_company_pos
  ON public.user_pinned_submodules (user_id, company_id, position);

ALTER TABLE public.user_pinned_submodules ENABLE ROW LEVEL SECURITY;

-- SELECT
CREATE POLICY "Users can view their own pins"
ON public.user_pinned_submodules
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  AND public.can_access_company(company_id)
);

-- INSERT
CREATE POLICY "Users can insert their own pins"
ON public.user_pinned_submodules
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.can_access_company(company_id)
);

-- UPDATE
CREATE POLICY "Users can update their own pins"
ON public.user_pinned_submodules
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND public.can_access_company(company_id)
)
WITH CHECK (
  auth.uid() = user_id
  AND public.can_access_company(company_id)
);

-- DELETE
CREATE POLICY "Users can delete their own pins"
ON public.user_pinned_submodules
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND public.can_access_company(company_id)
);

-- Auto-update updated_at
CREATE TRIGGER trg_user_pinned_submodules_updated_at
BEFORE UPDATE ON public.user_pinned_submodules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();