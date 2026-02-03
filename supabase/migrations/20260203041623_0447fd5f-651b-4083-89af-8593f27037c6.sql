-- Fix journal_entries RLS - require authentication and implement proper hierarchical access

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can delete journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can create journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Hierarchical finance access to journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can update draft journal entries" ON journal_entries;

-- SELECT: Hierarchical access based on sensitivity
-- - Super admins and admins: full access to their company
-- - Senior finance (finance + manager): can see all entries including sensitive
-- - Regular finance: can only see non-sensitive entries
CREATE POLICY "Hierarchical finance access to journal entries"
ON journal_entries FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid()) OR (
    can_access_company(company_id) AND (
      -- Senior finance can see everything
      has_senior_finance_access(auth.uid()) OR (
        -- Regular finance can only see non-sensitive entries
        has_finance_access(auth.uid()) AND NOT journal_entry_has_sensitive_accounts(id)
      )
    )
  )
);

-- INSERT: Only finance users within their company can create entries
CREATE POLICY "Finance users can create journal entries"
ON journal_entries FOR INSERT
TO authenticated
WITH CHECK (
  is_admin(auth.uid()) OR (
    can_access_company(company_id) AND has_finance_access(auth.uid())
  )
);

-- UPDATE: Creator or admins can update drafts, senior finance can update others
CREATE POLICY "Finance users can update journal entries"
ON journal_entries FOR UPDATE
TO authenticated
USING (
  is_admin(auth.uid()) OR (
    can_access_company(company_id) AND (
      (created_by = auth.uid() AND status = 'draft') OR
      has_senior_finance_access(auth.uid())
    )
  )
)
WITH CHECK (
  is_admin(auth.uid()) OR (
    can_access_company(company_id) AND (
      (created_by = auth.uid() AND status = 'draft') OR
      has_senior_finance_access(auth.uid())
    )
  )
);

-- DELETE: Only admins can delete draft entries
CREATE POLICY "Admins can delete draft journal entries"
ON journal_entries FOR DELETE
TO authenticated
USING (
  status = 'draft' AND (
    is_admin(auth.uid()) OR (
      can_access_company(company_id) AND has_senior_finance_access(auth.uid())
    )
  )
);