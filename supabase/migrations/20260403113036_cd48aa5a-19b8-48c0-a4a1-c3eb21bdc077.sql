
-- Create platform enum
CREATE TYPE public.social_media_platform AS ENUM (
  'facebook', 'instagram', 'linkedin', 'twitter', 'youtube',
  'tiktok', 'whatsapp', 'pinterest', 'snapchat', 'other'
);

-- 1. Social Media Accounts
CREATE TABLE public.social_media_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  platform social_media_platform NOT NULL DEFAULT 'other',
  account_name TEXT NOT NULL,
  account_handle TEXT,
  account_url TEXT,
  account_type TEXT NOT NULL DEFAULT 'business' CHECK (account_type IN ('business', 'personal', 'creator')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'archived')),
  description TEXT,
  profile_image_url TEXT,
  follower_count INTEGER DEFAULT 0,
  added_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_media_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view social media accounts"
  ON public.social_media_accounts FOR SELECT TO authenticated
  USING (can_access_company(company_id));

CREATE POLICY "Company users can insert social media accounts"
  ON public.social_media_accounts FOR INSERT TO authenticated
  WITH CHECK (can_access_company(company_id));

CREATE POLICY "Company users can update social media accounts"
  ON public.social_media_accounts FOR UPDATE TO authenticated
  USING (can_access_company(company_id))
  WITH CHECK (can_access_company(company_id));

CREATE POLICY "Admins can delete social media accounts"
  ON public.social_media_accounts FOR DELETE TO authenticated
  USING (can_access_company(company_id) AND is_admin(auth.uid()));

CREATE TRIGGER update_social_media_accounts_updated_at
  BEFORE UPDATE ON public.social_media_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Social Media Access
CREATE TABLE public.social_media_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.social_media_accounts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'viewer' CHECK (access_level IN ('admin', 'editor', 'viewer', 'analyst')),
  access_granted_by UUID,
  access_granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  access_revoked_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, user_id)
);

ALTER TABLE public.social_media_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view social media access"
  ON public.social_media_access FOR SELECT TO authenticated
  USING (can_access_company(company_id));

CREATE POLICY "Company users can insert social media access"
  ON public.social_media_access FOR INSERT TO authenticated
  WITH CHECK (can_access_company(company_id));

CREATE POLICY "Company users can update social media access"
  ON public.social_media_access FOR UPDATE TO authenticated
  USING (can_access_company(company_id))
  WITH CHECK (can_access_company(company_id));

CREATE POLICY "Admins can delete social media access"
  ON public.social_media_access FOR DELETE TO authenticated
  USING (can_access_company(company_id) AND is_admin(auth.uid()));

CREATE TRIGGER update_social_media_access_updated_at
  BEFORE UPDATE ON public.social_media_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Social Media NDAs
CREATE TABLE public.social_media_ndas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  access_id UUID REFERENCES public.social_media_access(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  nda_signed BOOLEAN NOT NULL DEFAULT false,
  nda_signed_at TIMESTAMPTZ,
  nda_expiry_date DATE,
  nda_document_url TEXT,
  nda_version TEXT DEFAULT '1.0',
  witnessed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_media_ndas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view social media ndas"
  ON public.social_media_ndas FOR SELECT TO authenticated
  USING (can_access_company(company_id));

CREATE POLICY "Company users can insert social media ndas"
  ON public.social_media_ndas FOR INSERT TO authenticated
  WITH CHECK (can_access_company(company_id));

CREATE POLICY "Company users can update social media ndas"
  ON public.social_media_ndas FOR UPDATE TO authenticated
  USING (can_access_company(company_id))
  WITH CHECK (can_access_company(company_id));

CREATE POLICY "Admins can delete social media ndas"
  ON public.social_media_ndas FOR DELETE TO authenticated
  USING (can_access_company(company_id) AND is_admin(auth.uid()));

CREATE TRIGGER update_social_media_ndas_updated_at
  BEFORE UPDATE ON public.social_media_ndas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Social Media Activity Log (append-only)
CREATE TABLE public.social_media_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.social_media_accounts(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  performed_by UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_media_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view activity log"
  ON public.social_media_activity_log FOR SELECT TO authenticated
  USING (can_access_company(company_id));

CREATE POLICY "Company users can insert activity log"
  ON public.social_media_activity_log FOR INSERT TO authenticated
  WITH CHECK (can_access_company(company_id));

-- No UPDATE or DELETE policies — append-only

-- 5. Storage bucket for NDA documents
INSERT INTO storage.buckets (id, name, public) VALUES ('social-media-nda-documents', 'social-media-nda-documents', false);

CREATE POLICY "Company users can view NDA documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'social-media-nda-documents');

CREATE POLICY "Company users can upload NDA documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'social-media-nda-documents');

CREATE POLICY "Admins can delete NDA documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'social-media-nda-documents' AND is_admin(auth.uid()));
