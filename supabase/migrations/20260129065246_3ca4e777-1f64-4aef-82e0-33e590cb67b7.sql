-- ============================================
-- HIERARCHICAL ACCESS CONTROLS FOR ACCOUNTING RECORDS
-- ============================================
-- This migration implements senior finance access controls to protect
-- sensitive accounting records like executive compensation, confidential
-- contracts, and sensitive business arrangements.

-- 1. Add sensitivity level to chart_of_accounts
ALTER TABLE public.chart_of_accounts 
ADD COLUMN IF NOT EXISTS is_sensitive boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sensitivity_reason text;

-- Add comment explaining the field
COMMENT ON COLUMN public.chart_of_accounts.is_sensitive IS 'Marks accounts that contain sensitive data (exec compensation, confidential contracts). Only senior finance users can view entries for these accounts.';
COMMENT ON COLUMN public.chart_of_accounts.sensitivity_reason IS 'Explanation of why this account is marked as sensitive';

-- 2. Create a senior_finance_users table to track users with elevated access
CREATE TABLE IF NOT EXISTS public.senior_finance_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    granted_by uuid REFERENCES auth.users(id),
    granted_at timestamptz DEFAULT now(),
    reason text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, company_id)
);

-- Enable RLS on the new table
ALTER TABLE public.senior_finance_users ENABLE ROW LEVEL SECURITY;