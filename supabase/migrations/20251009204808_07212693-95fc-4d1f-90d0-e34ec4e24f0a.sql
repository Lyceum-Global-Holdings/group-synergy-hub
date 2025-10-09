-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.goods_receipt_notes ENABLE ROW LEVEL SECURITY;

-- Adjust/update policy to allow creator to submit GRNs (draft -> submitted)
DO $$
DECLARE
  pol_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'goods_receipt_notes' 
      AND policyname = 'Users can update their own draft GRNs or admins can update any'
  ) INTO pol_exists;

  IF pol_exists THEN
    EXECUTE '
      ALTER POLICY "Users can update their own draft GRNs or admins can update any" ON public.goods_receipt_notes
      USING ((auth.uid() = created_by AND status IN (''draft'', ''submitted'')) OR is_admin(auth.uid()))
      WITH CHECK ((auth.uid() = created_by) OR is_admin(auth.uid()))
    ';
  ELSE
    -- Create a dedicated policy that allows creators to update their GRNs to submitted
    -- without being restricted to the old "draft-only" condition.
    EXECUTE '
      CREATE POLICY "Creators can submit GRNs (draft->submitted)"
      ON public.goods_receipt_notes
      FOR UPDATE
      USING ((auth.uid() = created_by AND status IN (''draft'', ''submitted'')) OR is_admin(auth.uid()))
      WITH CHECK ((auth.uid() = created_by) OR is_admin(auth.uid()))
    ';
  END IF;
END $$;