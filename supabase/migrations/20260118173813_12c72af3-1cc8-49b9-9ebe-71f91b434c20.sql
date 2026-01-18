-- Fix RLS policies for batch-related tables
-- The policies were incorrectly using profiles.id instead of profiles.user_id

-- =============================================
-- FIX item_batches RLS policies
-- =============================================
DROP POLICY IF EXISTS "Users can view batches in their company" ON item_batches;
DROP POLICY IF EXISTS "Users can insert batches in their company" ON item_batches;
DROP POLICY IF EXISTS "Users can update batches in their company" ON item_batches;
DROP POLICY IF EXISTS "Users can delete batches in their company" ON item_batches;

CREATE POLICY "Users can view batches in their company" ON item_batches
  FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert batches in their company" ON item_batches
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update batches in their company" ON item_batches
  FOR UPDATE USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete batches in their company" ON item_batches
  FOR DELETE USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- =============================================
-- FIX batch_stock_allocations RLS policies
-- =============================================
DROP POLICY IF EXISTS "Users can view batch allocations in their company" ON batch_stock_allocations;
DROP POLICY IF EXISTS "Users can insert batch allocations in their company" ON batch_stock_allocations;
DROP POLICY IF EXISTS "Users can update batch allocations in their company" ON batch_stock_allocations;
DROP POLICY IF EXISTS "Users can delete batch allocations in their company" ON batch_stock_allocations;

CREATE POLICY "Users can view batch allocations in their company" ON batch_stock_allocations
  FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert batch allocations in their company" ON batch_stock_allocations
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update batch allocations in their company" ON batch_stock_allocations
  FOR UPDATE USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete batch allocations in their company" ON batch_stock_allocations
  FOR DELETE USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));

-- =============================================
-- FIX batch_issue_details RLS policies
-- =============================================
DROP POLICY IF EXISTS "Users can view batch issue details" ON batch_issue_details;
DROP POLICY IF EXISTS "Users can insert batch issue details" ON batch_issue_details;

CREATE POLICY "Users can view batch issue details" ON batch_issue_details
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM material_issue_items mii
      JOIN material_issue_notes min ON min.id = mii.min_id
      WHERE mii.id = batch_issue_details.issue_item_id
      AND min.company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert batch issue details" ON batch_issue_details
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM material_issue_items mii
      JOIN material_issue_notes min ON min.id = mii.min_id
      WHERE mii.id = batch_issue_details.issue_item_id
      AND min.company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())
    )
  );