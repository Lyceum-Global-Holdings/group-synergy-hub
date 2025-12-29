-- Create the company_excluded_categories table
CREATE TABLE IF NOT EXISTS public.company_excluded_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES item_categories(id) ON DELETE CASCADE,
  excluded_at TIMESTAMPTZ DEFAULT NOW(),
  excluded_by UUID REFERENCES auth.users(id),
  UNIQUE(company_id, category_id)
);

-- Enable RLS
ALTER TABLE public.company_excluded_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view excluded categories"
  ON public.company_excluded_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert excluded categories"
  ON public.company_excluded_categories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = excluded_by);

CREATE POLICY "Authenticated users can delete excluded categories"
  ON public.company_excluded_categories FOR DELETE
  USING (auth.uid() IS NOT NULL);