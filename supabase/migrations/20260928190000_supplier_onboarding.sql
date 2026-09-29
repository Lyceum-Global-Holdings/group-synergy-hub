-- Supplier onboarding.
--
-- 1. Bank details. The registration asks for bank, branch, account holder,
--    account number, IBAN and SWIFT, but approval created the supplier without
--    them. Approval now runs in the database (approve_supplier_registration) and
--    creates the supplier, its primary contact and its bank profile
--    (supplier_profiles_extended, the record the supplier portal already edits)
--    in one step. The registration's documents move to the supplier.
--    Procurement and finance staff of the supplier's companies can now read the
--    bank profile; changing it stays with admins and the supplier's portal owner.
--
-- 2. Duplicates block instead of warn. find_supplier_duplicates compares
--    normalised tax IDs, emails, phone numbers and names with every supplier in
--    the group and with other applications waiting for the same company.
--    - Submitting a registration that matches needs a written reason.
--    - Approving one either links it to the matching supplier (which allocates
--      that supplier to the company; the application's bank details are NOT
--      copied onto an existing supplier) or creates a new supplier with the
--      approver's reason. A tax ID already on file can't become a new supplier.
--    - Submit and approve go through the new functions only; the status can't
--      be set directly any more (rejecting stays as before).
--    - The insert policy no longer lets anyone without a login add a pending
--      application directly, which skipped the captcha and the duplicate check.
--    - check_duplicate_supplier no longer answers anonymous callers (it listed
--      supplier emails and tax IDs to anyone) and no longer matches every
--      supplier with a blank phone number.
--
-- 3. Staff alerts. supplier_registration_reviewers(company) lists the people to
--    tell about a new public application (procurement staff and admins of that
--    company); the public-supplier-registration edge function emails them.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.supplier_profiles_extended
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_branch text;

ALTER TABLE public.supplier_registration_requests
  ADD COLUMN IF NOT EXISTS duplicate_reason text,
  ADD COLUMN IF NOT EXISTS duplicate_reason_by uuid,
  ADD COLUMN IF NOT EXISTS duplicate_reason_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Matching
-- ─────────────────────────────────────────────────────────────────────────────
-- "ABC Traders (Pvt) Ltd", "A.B.C. Traders" and "abc traders" all become "abctraders".
CREATE OR REPLACE FUNCTION public.supplier_norm_name(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT NULLIF(replace(
    regexp_replace(
      regexp_replace(lower(replace(COALESCE(p, ''), '&', ' and ')), '[^a-z0-9]+', ' ', 'g'),
      '( (pvt|private|ltd|limited|plc|inc|llc|co|company|corp|corporation|and))+ *$', ''),
    ' ', ''), '')
$$;

CREATE OR REPLACE FUNCTION public.supplier_norm_email(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE WHEN btrim(COALESCE(p, '')) LIKE '%_@_%' THEN lower(btrim(p)) END
$$;

-- Last nine digits, so +94 77 123 4567 and 077-1234567 match.
-- Placeholders such as 0000000000 match nothing.
CREATE OR REPLACE FUNCTION public.supplier_norm_phone(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE WHEN length(x) >= 9 AND right(x, 9) !~ '^(\d)\1*$' THEN right(x, 9) END
  FROM (SELECT regexp_replace(COALESCE(p, ''), '\D', '', 'g') AS x) s
$$;

-- Placeholders such as N/A, 0000 or "pending" match nothing.
CREATE OR REPLACE FUNCTION public.supplier_norm_tax_id(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE WHEN length(x) >= 5 AND x !~ '^(0+|NOTAPPLICABLE|NOTAVAILABLE|PENDING|NONE)$' THEN x END
  FROM (SELECT upper(regexp_replace(COALESCE(p, ''), '[^A-Za-z0-9]', '', 'g')) AS x) s
$$;

-- Suppliers anywhere in the group, plus applications waiting for the same
-- company, that share a tax ID, email, phone or name with p_data.
-- reasons is ordered strongest first: tax_id, email, phone, name.
CREATE OR REPLACE FUNCTION public.find_supplier_duplicates(
  p_data jsonb,
  p_company_id uuid DEFAULT NULL,
  p_exclude_registration uuid DEFAULT NULL
)
RETURNS TABLE (kind text, id uuid, name text, code text, status text, reasons text[], in_company boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH d AS (
    SELECT public.supplier_norm_name(COALESCE(p_data->>'supplier_name', p_data->>'name')) AS n,
           public.supplier_norm_email(p_data->>'email') AS e,
           public.supplier_norm_email(p_data->>'primary_contact_email') AS e2,
           public.supplier_norm_phone(p_data->>'phone') AS ph,
           public.supplier_norm_tax_id(p_data->>'tax_id') AS t
  ),
  s AS (
    SELECT 'supplier'::text AS kind, s.id, s.name, s.supplier_code AS code, s.status,
           array_remove(ARRAY[
             CASE WHEN public.supplier_norm_tax_id(s.tax_id) = d.t THEN 'tax_id' END,
             CASE WHEN public.supplier_norm_email(s.email) IN (d.e, d.e2) THEN 'email' END,
             CASE WHEN public.supplier_norm_phone(s.phone) = d.ph THEN 'phone' END,
             CASE WHEN length(d.n) >= 3 AND public.supplier_norm_name(s.name) = d.n THEN 'name' END
           ], NULL) AS reasons,
           (s.company_id = p_company_id
            OR EXISTS (SELECT 1 FROM public.company_suppliers cs
                       WHERE cs.supplier_id = s.id AND cs.company_id = p_company_id)) AS in_company
    FROM public.suppliers s, d
  ),
  r AS (
    SELECT 'application'::text, r.id, COALESCE(r.supplier_data->>'supplier_name', r.supplier_data->>'name'),
           NULL::text, r.status,
           array_remove(ARRAY[
             CASE WHEN public.supplier_norm_tax_id(r.supplier_data->>'tax_id') = d.t THEN 'tax_id' END,
             CASE WHEN public.supplier_norm_email(r.supplier_data->>'email') IN (d.e, d.e2) THEN 'email' END,
             CASE WHEN public.supplier_norm_phone(r.supplier_data->>'phone') = d.ph THEN 'phone' END,
             CASE WHEN length(d.n) >= 3
                   AND public.supplier_norm_name(COALESCE(r.supplier_data->>'supplier_name', r.supplier_data->>'name')) = d.n
                  THEN 'name' END
           ], NULL),
           true
    FROM public.supplier_registration_requests r, d
    WHERE r.status = 'pending_approval'
      AND r.company_id IS NOT DISTINCT FROM p_company_id
      AND r.id IS DISTINCT FROM p_exclude_registration
  )
  SELECT x.kind, x.id, x.name, x.code, x.status, x.reasons, COALESCE(x.in_company, false)
  FROM (SELECT * FROM s UNION ALL SELECT * FROM r) x
  WHERE cardinality(x.reasons) > 0
  ORDER BY x.kind = 'application', 'tax_id' = ANY (x.reasons) DESC, cardinality(x.reasons) DESC, x.name
  LIMIT 10
$$;

-- One line per match, for error messages and the approval log.
CREATE OR REPLACE FUNCTION public.supplier_duplicates_text(p_data jsonb, p_company_id uuid, p_exclude_registration uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT string_agg(
           CASE WHEN f.kind = 'supplier' THEN f.code || ' ' || f.name ELSE 'the application from ' || f.name END
           || ' (' || replace(array_to_string(f.reasons, ', '), 'tax_id', 'tax ID') || ')',
           '; ')
  FROM public.find_supplier_duplicates(p_data, p_company_id, p_exclude_registration) f
$$;

-- Signed-in staff, as opposed to supplier-portal users.
CREATE OR REPLACE FUNCTION public.is_staff_user(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user IS NOT NULL
     AND (public.is_admin(p_user)
          OR EXISTS (SELECT 1 FROM public.profiles
                     WHERE user_id = p_user AND company_id IS NOT NULL AND deactivated_at IS NULL))
     AND NOT EXISTS (SELECT 1 FROM public.supplier_users WHERE user_id = p_user AND is_active)
$$;

-- Same signature and columns as before (the wizard's live warning and older
-- edge-function builds use it), now on the normalised matching.
CREATE OR REPLACE FUNCTION public.check_duplicate_supplier(
  p_supplier_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_tax_id text DEFAULT NULL
)
RETURNS TABLE (id uuid, supplier_name text, email text, phone text, tax_id text, match_reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No user means the service role (anon can't execute this any more).
  IF auth.uid() IS NOT NULL AND NOT public.is_staff_user(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT s.id, s.name, s.email, s.phone, s.tax_id, f.reasons[1]
  FROM public.find_supplier_duplicates(
         jsonb_build_object('supplier_name', p_supplier_name, 'email', p_email, 'phone', p_phone, 'tax_id', p_tax_id),
         NULL, NULL) f
  JOIN public.suppliers s ON s.id = f.id
  WHERE f.kind = 'supplier'
  LIMIT 5;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Submit, review, approve
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_supplier_registration(
  p_registration_id uuid,
  p_duplicate_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.supplier_registration_requests%ROWTYPE;
  v_reason text := NULLIF(btrim(COALESCE(p_duplicate_reason, '')), '');
  v_dups text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r FROM public.supplier_registration_requests WHERE id = p_registration_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found.' USING ERRCODE = 'P0002';
  END IF;
  IF r.created_by IS DISTINCT FROM v_uid AND NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Only the person who started this registration can submit it.' USING ERRCODE = '42501';
  END IF;
  IF r.status <> 'draft' THEN
    RAISE EXCEPTION 'This registration has already been submitted.';
  END IF;
  IF r.company_id IS NULL THEN
    RAISE EXCEPTION 'Choose a company before submitting the registration.';
  END IF;
  IF NULLIF(btrim(COALESCE(r.supplier_data->>'supplier_name', r.supplier_data->>'name')), '') IS NULL THEN
    RAISE EXCEPTION 'Enter the supplier name before submitting.';
  END IF;

  v_dups := public.supplier_duplicates_text(r.supplier_data, r.company_id, r.id);
  IF v_dups IS NOT NULL AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Possible duplicate of %. Explain why this is a different supplier to submit it.', v_dups;
  END IF;

  UPDATE public.supplier_registration_requests
     SET status = 'pending_approval',
         submitted_by = v_uid,
         submitted_at = now(),
         duplicate_reason = CASE WHEN v_dups IS NOT NULL THEN v_reason END,
         duplicate_reason_by = CASE WHEN v_dups IS NOT NULL THEN v_uid END,
         duplicate_reason_at = CASE WHEN v_dups IS NOT NULL THEN now() END
   WHERE id = r.id;

  INSERT INTO public.supplier_approval_workflow (registration_request_id, stage, status, completed_by, completed_at, notes)
  VALUES (r.id, 'submitted', 'completed', v_uid, now(),
          CASE WHEN v_dups IS NOT NULL THEN format('Possible duplicate of %s. Reason given: %s', v_dups, v_reason) END);
END;
$$;

-- What the approval screen and the wizard's review step need.
CREATE OR REPLACE FUNCTION public.supplier_registration_review(p_registration_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.supplier_registration_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.supplier_registration_requests WHERE id = p_registration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_uid IS NULL OR NOT (
       public.is_admin(v_uid)
       OR r.created_by = v_uid
       OR (r.company_id IS NOT NULL AND public.user_in_company(v_uid, r.company_id))) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'status', r.status,
    'can_approve', r.status = 'pending_approval' AND public.is_admin(v_uid),
    'duplicate_reason', r.duplicate_reason,
    'duplicates', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'kind', f.kind, 'id', f.id, 'name', f.name, 'code', f.code, 'status', f.status,
               'reasons', to_jsonb(f.reasons), 'in_company', f.in_company) ORDER BY f.ord)
      FROM public.find_supplier_duplicates(r.supplier_data, r.company_id, r.id)
           WITH ORDINALITY AS f(kind, id, name, code, status, reasons, in_company, ord)
    ), '[]'::jsonb)
  );
END;
$$;

-- Creates the supplier (or links an existing one) and approves the registration.
-- Returns the supplier id.
CREATE OR REPLACE FUNCTION public.approve_supplier_registration(
  p_registration_id uuid,
  p_notes text DEFAULT NULL,
  p_duplicate_reason text DEFAULT NULL,
  p_link_supplier_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.supplier_registration_requests%ROWTYPE;
  d jsonb;
  v_name text;
  v_reason text := NULLIF(btrim(COALESCE(p_duplicate_reason, '')), '');
  v_dups text;
  v_hit record;
  v_supplier uuid;
  v_code text;
  v_currency text;
  v_note text;
  v_has_bank boolean;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Only an administrator can approve supplier registrations.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r FROM public.supplier_registration_requests WHERE id = p_registration_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found.' USING ERRCODE = 'P0002';
  END IF;
  IF r.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'This registration is %, not waiting for approval.', replace(r.status, '_', ' ');
  END IF;

  d := r.supplier_data;
  v_name := NULLIF(btrim(COALESCE(d->>'supplier_name', d->>'name')), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'The registration has no supplier name.';
  END IF;
  v_has_bank := COALESCE(NULLIF(btrim(d->>'bank_account_number'), ''), NULLIF(btrim(d->>'iban'), ''),
                         NULLIF(btrim(d->>'bank_iban'), '')) IS NOT NULL;

  IF p_link_supplier_id IS NOT NULL THEN
    -- Link to a supplier the registration matches.
    SELECT f.name, f.code, f.reasons INTO v_hit
    FROM public.find_supplier_duplicates(d, r.company_id, r.id) f
    WHERE f.kind = 'supplier' AND f.id = p_link_supplier_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That supplier doesn''t match this registration, so it can''t be linked.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.supplier_blacklist
               WHERE supplier_id = p_link_supplier_id AND status = 'blacklisted') THEN
      RAISE EXCEPTION '% is blacklisted. Clear it in Sourcing › Blacklist before linking.', v_hit.name;
    END IF;
    v_supplier := p_link_supplier_id;
    v_note := format('Linked to existing supplier %s %s (matched on %s).', v_hit.code, v_hit.name,
                     replace(array_to_string(v_hit.reasons, ', '), 'tax_id', 'tax ID'));
    -- Bank details on an application never overwrite or fill an existing
    -- supplier's: a lookalike application could redirect its payments.
    IF v_has_bank THEN
      v_note := v_note || ' The bank details on the application were not copied; check them with the supplier before changing its bank record.';
    END IF;
  ELSE
    SELECT f.name, f.code INTO v_hit
    FROM public.find_supplier_duplicates(d, r.company_id, r.id) f
    WHERE f.kind = 'supplier' AND 'tax_id' = ANY (f.reasons)
    LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'Tax ID % is already on file for % %. Link the registration to that supplier instead of creating a new one.',
        btrim(d->>'tax_id'), v_hit.code, v_hit.name;
    END IF;

    v_dups := public.supplier_duplicates_text(d, r.company_id, r.id);
    IF v_dups IS NOT NULL AND v_reason IS NULL THEN
      RAISE EXCEPTION 'Possible duplicate of %. Link the registration to the existing supplier, or give a reason to create a new one.', v_dups;
    END IF;
    IF v_dups IS NOT NULL THEN
      v_note := format('Created as a new supplier despite possible duplicates (%s). Reason: %s', v_dups, v_reason);
    END IF;

    v_currency := CASE WHEN upper(btrim(d->>'currency')) ~ '^[A-Z]{3}$' THEN upper(btrim(d->>'currency')) END;

    FOR i IN 1..3 LOOP
      v_code := public.generate_next_supplier_code(r.company_id);
      BEGIN
        INSERT INTO public.suppliers (
          supplier_code, name, legal_name, email, phone, tax_id, supplier_type, category, material_type,
          website, registration_number, address_line1, city, state, postal_code, country,
          payment_terms, currency, notes, company_id, status, created_by
        ) VALUES (
          v_code, v_name, v_name,
          NULLIF(btrim(d->>'email'), ''), NULLIF(btrim(d->>'phone'), ''), NULLIF(btrim(d->>'tax_id'), ''),
          COALESCE(NULLIF(btrim(d->>'supplier_type'), ''), 'vendor'),
          NULLIF(btrim(d->>'category'), ''), NULLIF(btrim(d->>'material_type'), ''),
          NULLIF(btrim(d->>'website'), ''), NULLIF(btrim(d->>'registration_number'), ''),
          NULLIF(btrim(d->>'street_address'), ''), NULLIF(btrim(d->>'city'), ''),
          NULLIF(btrim(d->>'state_province'), ''), NULLIF(btrim(d->>'postal_code'), ''),
          NULLIF(btrim(d->>'country'), ''), NULLIF(btrim(d->>'payment_terms'), ''),
          COALESCE(v_currency, 'LKR'),
          CASE WHEN NULLIF(btrim(d->>'trading_name'), '') IS NOT NULL THEN 'Trading as ' || btrim(d->>'trading_name') END,
          r.company_id, 'active', v_uid
        )
        RETURNING id INTO v_supplier;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF i = 3 THEN RAISE; END IF;
      END;
    END LOOP;

    IF NULLIF(btrim(d->>'primary_contact_name'), '') IS NOT NULL THEN
      INSERT INTO public.supplier_contacts (supplier_id, name, email, phone, is_primary)
      VALUES (v_supplier, btrim(d->>'primary_contact_name'),
              NULLIF(btrim(COALESCE(NULLIF(d->>'primary_contact_email', ''), d->>'email')), ''),
              NULLIF(btrim(COALESCE(NULLIF(d->>'primary_contact_phone', ''), d->>'phone')), ''),
              true);
    END IF;

    -- The wizard uses bank_branch/swift_code; the public form uses
    -- bank_account_holder/iban/swift_code.
    INSERT INTO public.supplier_profiles_extended (
      supplier_id, legal_name, tax_id, bank_name, bank_branch, bank_account_name, bank_account_number,
      bank_iban, bank_swift, default_currency, default_payment_terms_days, updated_by
    ) VALUES (
      v_supplier, v_name, NULLIF(btrim(d->>'tax_id'), ''),
      NULLIF(btrim(d->>'bank_name'), ''),
      NULLIF(btrim(d->>'bank_branch'), ''),
      NULLIF(btrim(COALESCE(NULLIF(d->>'bank_account_holder', ''), d->>'bank_account_name')), ''),
      NULLIF(btrim(d->>'bank_account_number'), ''),
      NULLIF(upper(regexp_replace(COALESCE(NULLIF(d->>'iban', ''), d->>'bank_iban', ''), '\s', '', 'g')), ''),
      NULLIF(upper(btrim(COALESCE(NULLIF(d->>'swift_code', ''), d->>'bank_swift', ''))), ''),
      v_currency,
      substring(lower(d->>'payment_terms') FROM '^net_?(\d{1,3})$')::int,
      v_uid
    )
    ON CONFLICT (supplier_id) DO NOTHING;
  END IF;

  -- The allocation trigger adds the supplier to the registration's company.
  UPDATE public.supplier_registration_requests
     SET status = 'approved', reviewed_by = v_uid, reviewed_at = now(), supplier_id = v_supplier
   WHERE id = r.id;

  UPDATE public.supplier_documents
     SET supplier_id = v_supplier
   WHERE registration_request_id = r.id AND supplier_id IS NULL;

  IF v_note IS NOT NULL THEN
    INSERT INTO public.supplier_approval_workflow (registration_request_id, stage, status, completed_by, completed_at, notes)
    VALUES (r.id, 'duplicate_check', 'completed', v_uid, now(), v_note);
  END IF;
  INSERT INTO public.supplier_approval_workflow (registration_request_id, stage, status, completed_by, completed_at, notes)
  VALUES (r.id, 'approved', 'completed', v_uid, now(), NULLIF(btrim(COALESCE(p_notes, '')), ''));

  RETURN v_supplier;
END;
$$;

-- Status changes by signed-in users go through the functions above; statements
-- inside them run as the function owner and pass. Rejecting stays direct.
CREATE OR REPLACE FUNCTION public.guard_supplier_registration()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'New registrations start as drafts; submit them from the registration wizard.' USING ERRCODE = '42501';
    END IF;
    IF NEW.supplier_id IS NOT NULL OR NEW.duplicate_reason IS NOT NULL THEN
      RAISE EXCEPTION 'These fields are set when the registration is submitted or approved.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'pending_approval' AND NEW.status = 'rejected') THEN
    RAISE EXCEPTION 'Use Submit or Approve for this step; the status can''t be changed directly.' USING ERRCODE = '42501';
  END IF;
  IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
     OR NEW.duplicate_reason IS DISTINCT FROM OLD.duplicate_reason
     OR NEW.duplicate_reason_by IS DISTINCT FROM OLD.duplicate_reason_by
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
    RAISE EXCEPTION 'These fields are set when the registration is submitted or approved.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_supplier_registration ON public.supplier_registration_requests;
CREATE TRIGGER trg_guard_supplier_registration
  BEFORE INSERT OR UPDATE ON public.supplier_registration_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_supplier_registration();

-- Public applications arrive through the edge function (service role) only.
DROP POLICY IF EXISTS "Users can create registration requests" ON public.supplier_registration_requests;
CREATE POLICY "Users can create registration requests"
  ON public.supplier_registration_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Bank profile readable by the supplier's procurement and finance staff
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff read supplier bank profile" ON public.supplier_profiles_extended;
CREATE POLICY "staff read supplier bank profile"
  ON public.supplier_profiles_extended FOR SELECT
  TO authenticated
  USING (
    (public.has_procurement_access(auth.uid()) OR public.has_finance_access(auth.uid()))
    AND (EXISTS (SELECT 1 FROM public.suppliers s
                 WHERE s.id = supplier_profiles_extended.supplier_id AND public.can_access_company(s.company_id))
         OR EXISTS (SELECT 1 FROM public.company_suppliers cs
                    WHERE cs.supplier_id = supplier_profiles_extended.supplier_id AND public.can_access_company(cs.company_id)))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Who hears about a new public application
-- ─────────────────────────────────────────────────────────────────────────────
-- Procurement staff and admins of the company. Super admins only when nobody
-- else would hear (or the application has no company).
CREATE OR REPLACE FUNCTION public.supplier_registration_reviewers(p_company_id uuid)
RETURNS TABLE (email text, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH staff AS (
    SELECT DISTINCT ON (lower(p.email)) btrim(p.email) AS email, p.full_name,
           public.is_super_admin(p.user_id) AS is_super
    FROM public.profiles p
    WHERE p.deactivated_at IS NULL
      AND p.email LIKE '%_@_%'
      AND public.has_procurement_access(p.user_id)
      AND (p.company_id = p_company_id
           OR EXISTS (SELECT 1 FROM public.user_company_access a
                      WHERE a.user_id = p.user_id AND a.company_id = p_company_id)
           OR public.is_super_admin(p.user_id))
    ORDER BY lower(p.email)
  )
  SELECT staff.email, staff.full_name
  FROM staff
  WHERE NOT staff.is_super OR NOT EXISTS (SELECT 1 FROM staff s2 WHERE NOT s2.is_super)
  ORDER BY staff.is_super, lower(staff.email)
  LIMIT 25
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Grants
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.find_supplier_duplicates(jsonb, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_supplier_duplicates(jsonb, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.supplier_duplicates_text(jsonb, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.supplier_registration_reviewers(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_registration_reviewers(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.check_duplicate_supplier(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_duplicate_supplier(text, text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_staff_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff_user(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_supplier_registration(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_supplier_registration(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.supplier_registration_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supplier_registration_review(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.approve_supplier_registration(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_supplier_registration(uuid, text, text, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only check after applying:
--   SELECT
--     (SELECT count(*) FROM pg_proc WHERE proname IN (
--        'find_supplier_duplicates', 'submit_supplier_registration', 'supplier_registration_review',
--        'approve_supplier_registration', 'supplier_registration_reviewers', 'is_staff_user')) AS functions,  -- 6
--     (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_guard_supplier_registration') AS guard_trigger,    -- 1
--     has_function_privilege('anon', 'public.check_duplicate_supplier(text,text,text,text)', 'EXECUTE') AS anon_can_check,  -- false
--     (SELECT count(*) FROM public.supplier_registration_requests WHERE status = 'pending_approval') AS waiting_applications;
-- ─────────────────────────────────────────────────────────────────────────────
