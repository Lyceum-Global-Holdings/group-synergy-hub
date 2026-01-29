-- ============================================
-- HIERARCHICAL ACCESS CONTROLS - FUNCTIONS AND POLICIES
-- ============================================

-- 3. Create a security definer function to check if user has senior finance access
CREATE OR REPLACE FUNCTION public.has_senior_finance_access(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.senior_finance_users sfu
        JOIN public.profiles p ON p.user_id = check_user_id
        WHERE sfu.user_id = check_user_id
        AND sfu.is_active = true
        AND sfu.company_id = p.company_id
    )
    OR is_admin(check_user_id)  -- Admins always have senior finance access
$$;

-- 4. Create a function to check if a journal entry involves sensitive accounts
CREATE OR REPLACE FUNCTION public.journal_entry_has_sensitive_accounts(je_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.journal_entry_lines jel
        JOIN public.chart_of_accounts coa ON jel.account_id = coa.id
        WHERE jel.journal_entry_id = je_id
        AND coa.is_sensitive = true
    )
$$;

-- 5. Drop existing SELECT policy on journal_entries and create new hierarchical one
DROP POLICY IF EXISTS "Finance users can view journal entries" ON public.journal_entries;

CREATE POLICY "Hierarchical finance access to journal entries"
ON public.journal_entries
FOR SELECT
USING (
    can_access_company(company_id) 
    AND has_finance_access(auth.uid())
    AND (
        -- Senior finance users and admins can see everything
        has_senior_finance_access(auth.uid())
        OR
        -- Regular finance users can only see non-sensitive entries
        NOT journal_entry_has_sensitive_accounts(id)
    )
);

-- 6. Drop existing SELECT policy on journal_entry_lines and create new hierarchical one
DROP POLICY IF EXISTS "Users can view JE lines" ON public.journal_entry_lines;

CREATE POLICY "Hierarchical finance access to journal entry lines"
ON public.journal_entry_lines
FOR SELECT
USING (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM public.journal_entries je
        WHERE je.id = journal_entry_id
        AND can_access_company(je.company_id)
        AND has_finance_access(auth.uid())
        AND (
            has_senior_finance_access(auth.uid())
            OR NOT journal_entry_has_sensitive_accounts(je.id)
        )
    )
);

-- 7. RLS policies for senior_finance_users table
-- Only admins can view/manage senior finance users
CREATE POLICY "Admins can view senior finance users"
ON public.senior_finance_users
FOR SELECT
USING (
    is_admin(auth.uid()) 
    AND can_access_company(company_id)
);

CREATE POLICY "Admins can insert senior finance users"
ON public.senior_finance_users
FOR INSERT
WITH CHECK (
    is_admin(auth.uid()) 
    AND can_access_company(company_id)
);

CREATE POLICY "Admins can update senior finance users"
ON public.senior_finance_users
FOR UPDATE
USING (
    is_admin(auth.uid()) 
    AND can_access_company(company_id)
);

CREATE POLICY "Admins can delete senior finance users"
ON public.senior_finance_users
FOR DELETE
USING (
    is_admin(auth.uid()) 
    AND can_access_company(company_id)
);

-- 8. Create trigger for updated_at on senior_finance_users
CREATE TRIGGER update_senior_finance_users_updated_at
BEFORE UPDATE ON public.senior_finance_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_senior_finance_users_user_id ON public.senior_finance_users(user_id);
CREATE INDEX IF NOT EXISTS idx_senior_finance_users_company_id ON public.senior_finance_users(company_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_is_sensitive ON public.chart_of_accounts(is_sensitive) WHERE is_sensitive = true;

-- 10. Grant appropriate permissions
GRANT SELECT ON public.senior_finance_users TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.senior_finance_users TO authenticated;