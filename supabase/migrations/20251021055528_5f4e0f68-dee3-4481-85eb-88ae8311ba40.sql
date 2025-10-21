-- Create gl_settings table to store general ledger configuration per company
CREATE TABLE IF NOT EXISTS public.gl_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  base_currency VARCHAR(3) NOT NULL DEFAULT 'LKR',
  currency_symbol VARCHAR(10) NOT NULL DEFAULT 'Rs.',
  decimal_places INTEGER NOT NULL DEFAULT 2,
  date_format VARCHAR(50) DEFAULT 'DD/MM/YYYY',
  je_number_format VARCHAR(100) DEFAULT 'JE-YYYYMMDD-###',
  require_je_approval BOOLEAN DEFAULT false,
  approval_threshold_amount NUMERIC(15,2),
  allow_posting_to_closed_periods BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.gl_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view GL settings for their company"
  ON public.gl_settings
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert GL settings"
  ON public.gl_settings
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update GL settings"
  ON public.gl_settings
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id 
      FROM public.profiles 
      WHERE user_id = auth.uid()
    )
  );

-- Create default GL settings for all existing companies
INSERT INTO public.gl_settings (company_id, base_currency, currency_symbol, decimal_places)
SELECT id, 'LKR', 'Rs.', 2
FROM public.companies
WHERE id NOT IN (SELECT company_id FROM public.gl_settings)
ON CONFLICT (company_id) DO NOTHING;

-- Trigger to create GL settings when a new company is created
CREATE OR REPLACE FUNCTION public.create_default_gl_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.gl_settings (company_id, base_currency, currency_symbol, decimal_places)
  VALUES (NEW.id, 'LKR', 'Rs.', 2)
  ON CONFLICT (company_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_default_gl_settings
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.create_default_gl_settings();