-- Social media: access by request and approval, NDA first, reliable log.
--
-- 1. Access rows stored the user's profile id where a login (auth user) id
--    belongs. They are converted, new rows must reference a login, and the
--    user list only offers active users of the company.
-- 2. Access is requested, then approved or rejected by a manager or admin of
--    the company — not by the person it is for or the person who asked. It can
--    only be approved once a signed, unexpired NDA with its document is on file.
--    Level changes and revoking are for approvers too. Requests, approvals and
--    NDAs go through functions; the tables no longer take direct writes.
-- 3. NDAs record the witness by name and keep the signed document (uploaded to
--    the company's folder in the social-media-nda-documents bucket). A nightly
--    job suspends access whose NDA has expired; renewing the NDA restores it.
-- 4. The activity log is written by the database in the same transaction as
--    the change (including account added / changed / deactivated), so entries
--    can't be skipped or forged.
--
-- Safe to run more than once.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. User ids: profile id → login id
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.social_media_access a
   SET user_id = p.user_id
  FROM public.profiles p
 WHERE a.user_id = p.id
   AND p.user_id <> p.id
   AND NOT EXISTS (SELECT 1 FROM public.social_media_access b
                    WHERE b.account_id = a.account_id AND b.user_id = p.user_id);

UPDATE public.social_media_ndas n
   SET user_id = p.user_id
  FROM public.profiles p
 WHERE n.user_id = p.id AND p.user_id <> p.id;

UPDATE public.social_media_activity_log l
   SET details = jsonb_set(l.details, '{user_id}', to_jsonb(p.user_id::text))
  FROM public.profiles p
 WHERE l.details ? 'user_id' AND l.details->>'user_id' = p.id::text;

-- New rows must reference a login (existing rows aren't re-checked).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_media_access_user_id_fkey') THEN
    ALTER TABLE public.social_media_access
      ADD CONSTRAINT social_media_access_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.social_media_access
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS decided_by uuid,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decision_note text;

UPDATE public.social_media_access
   SET status = CASE WHEN is_active THEN 'active' ELSE 'revoked' END
 WHERE status IS NULL;

ALTER TABLE public.social_media_access
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'social_media_access_status_check') THEN
    ALTER TABLE public.social_media_access
      ADD CONSTRAINT social_media_access_status_check
      CHECK (status IN ('pending', 'active', 'rejected', 'revoked', 'nda_expired'));
  END IF;
END $$;

-- is_active stays as the "can use the account now" flag.
CREATE OR REPLACE FUNCTION public.sync_social_media_access_active()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.is_active := NEW.status = 'active';
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_social_media_access_active ON public.social_media_access;
CREATE TRIGGER trg_sync_social_media_access_active
  BEFORE INSERT OR UPDATE ON public.social_media_access
  FOR EACH ROW EXECUTE FUNCTION public.sync_social_media_access_active();

ALTER TABLE public.social_media_ndas
  ADD COLUMN IF NOT EXISTS witness_name text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Helpers
-- ─────────────────────────────────────────────────────────────────────────────
-- Managers and admins of the company approve access.
CREATE OR REPLACE FUNCTION public.can_approve_social_media(p_user uuid, p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_user IS NOT NULL
     AND public.user_in_company(p_user, p_company_id)
     AND (public.is_admin(p_user) OR public.has_manager_access(p_user))
$$;

CREATE OR REPLACE FUNCTION public.social_media_rights(p_company_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object('can_approve', public.can_approve_social_media(auth.uid(), p_company_id))
$$;

-- The NDA that counts for an access row: its most recent one.
CREATE OR REPLACE FUNCTION public.social_media_current_nda(p_access_id uuid)
RETURNS public.social_media_ndas
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT n.* FROM public.social_media_ndas n
   WHERE n.access_id = p_access_id
   ORDER BY n.nda_signed DESC, n.nda_signed_at DESC NULLS LAST, n.created_at DESC
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.social_media_nda_valid(p_access_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT n.nda_signed AND (n.nda_expiry_date IS NULL OR n.nda_expiry_date >= CURRENT_DATE)
      FROM public.social_media_current_nda(p_access_id) n
     WHERE n.id IS NOT NULL), false)
$$;

CREATE OR REPLACE FUNCTION public.log_social_media(p_company_id uuid, p_account_id uuid, p_action text, p_details jsonb)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.social_media_activity_log (company_id, account_id, action, performed_by, details)
  VALUES (p_company_id, p_account_id, p_action, auth.uid(), COALESCE(p_details, '{}'::jsonb))
$$;

-- Active users of the company, by login id (for the user picker and names).
CREATE OR REPLACE FUNCTION public.social_media_company_users(p_company_id uuid)
RETURNS TABLE (user_id uuid, full_name text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_company(p_company_id) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.user_id, p.full_name, p.email
    FROM public.profiles p
   WHERE p.deactivated_at IS NULL
     AND (p.company_id = p_company_id
          OR EXISTS (SELECT 1 FROM public.user_company_access a
                      WHERE a.user_id = p.user_id AND a.company_id = p_company_id))
   ORDER BY p.full_name NULLS LAST, p.email;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Request, decide, change, revoke
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_social_media_access(
  p_account_id uuid,
  p_user_id uuid,
  p_access_level text,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_account public.social_media_accounts%ROWTYPE;
  v_existing public.social_media_access%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO v_account FROM public.social_media_accounts WHERE id = p_account_id;
  IF NOT FOUND OR NOT public.can_access_company(v_account.company_id) THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_account.status <> 'active' THEN
    RAISE EXCEPTION 'This account is %, so access can''t be requested', v_account.status;
  END IF;
  IF p_access_level NOT IN ('admin', 'editor', 'viewer', 'analyst') THEN
    RAISE EXCEPTION 'Unknown access level %', p_access_level;
  END IF;
  IF NOT public.user_in_company(p_user_id, v_account.company_id)
     OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id AND deactivated_at IS NOT NULL)
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Choose an active user of this company';
  END IF;

  SELECT * INTO v_existing FROM public.social_media_access
   WHERE account_id = p_account_id AND user_id = p_user_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.status = 'pending' THEN
      RAISE EXCEPTION 'A request for this person is already waiting for approval';
    ELSIF v_existing.status = 'active' THEN
      RAISE EXCEPTION 'This person already has access; change the level instead';
    ELSIF v_existing.status = 'nda_expired' THEN
      RAISE EXCEPTION 'Access is suspended because the NDA expired; renew the NDA in NDA Compliance';
    END IF;
    UPDATE public.social_media_access
       SET status = 'pending', access_level = p_access_level, notes = NULLIF(btrim(COALESCE(p_notes, '')), ''),
           requested_by = v_uid, requested_at = now(),
           decided_by = NULL, decided_at = NULL, decision_note = NULL, access_revoked_at = NULL
     WHERE id = v_existing.id
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.social_media_access (company_id, account_id, user_id, access_level, status, notes, requested_by, requested_at)
    VALUES (v_account.company_id, p_account_id, p_user_id, p_access_level, 'pending',
            NULLIF(btrim(COALESCE(p_notes, '')), ''), v_uid, now())
    RETURNING id INTO v_id;
  END IF;

  PERFORM public.log_social_media(v_account.company_id, p_account_id, 'access_requested',
    jsonb_build_object('access_id', v_id, 'user_id', p_user_id, 'access_level', p_access_level));
  RETURN v_id;
END;
$$;

-- Why the caller can't approve this request now (NULL = they can).
CREATE OR REPLACE FUNCTION public.social_media_access_block_reason(p_access_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.social_media_access%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.social_media_access WHERE id = p_access_id;
  IF NOT FOUND THEN RETURN 'Access request not found'; END IF;
  IF r.status <> 'pending' THEN RETURN 'This request isn''t waiting for approval'; END IF;
  IF NOT public.can_approve_social_media(v_uid, r.company_id) THEN
    RETURN 'Only a manager or admin of this company can approve access';
  END IF;
  IF r.user_id = v_uid THEN RETURN 'You can''t approve access for yourself'; END IF;
  IF r.requested_by = v_uid AND NOT public.is_admin(v_uid) THEN
    RETURN 'You asked for this access, so someone else must approve it';
  END IF;
  IF NOT public.social_media_nda_valid(p_access_id) THEN
    RETURN 'A signed, unexpired NDA must be recorded first (NDA Compliance)';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_social_media_access(p_access_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.social_media_access%ROWTYPE;
  v_reason text;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  SELECT * INTO r FROM public.social_media_access WHERE id = p_access_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Access request not found' USING ERRCODE = 'P0002'; END IF;

  IF p_approve THEN
    v_reason := public.social_media_access_block_reason(p_access_id);
    IF v_reason IS NOT NULL THEN RAISE EXCEPTION '%', v_reason USING ERRCODE = '42501'; END IF;
    UPDATE public.social_media_access
       SET status = 'active', decided_by = v_uid, decided_at = now(), decision_note = v_note,
           access_granted_by = v_uid, access_granted_at = now(), access_revoked_at = NULL
     WHERE id = p_access_id;
    PERFORM public.log_social_media(r.company_id, r.account_id, 'access_granted',
      jsonb_build_object('access_id', r.id, 'user_id', r.user_id, 'access_level', r.access_level, 'note', v_note));
    RETURN 'active';
  END IF;

  -- Rejecting: same approvers; the NDA isn't needed to say no.
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'This request isn''t waiting for approval'; END IF;
  IF NOT public.can_approve_social_media(v_uid, r.company_id) THEN
    RAISE EXCEPTION 'Only a manager or admin of this company can reject access' USING ERRCODE = '42501';
  END IF;
  IF v_note IS NULL THEN RAISE EXCEPTION 'Give a reason for rejecting'; END IF;
  UPDATE public.social_media_access
     SET status = 'rejected', decided_by = v_uid, decided_at = now(), decision_note = v_note
   WHERE id = p_access_id;
  PERFORM public.log_social_media(r.company_id, r.account_id, 'access_rejected',
    jsonb_build_object('access_id', r.id, 'user_id', r.user_id, 'note', v_note));
  RETURN 'rejected';
END;
$$;

CREATE OR REPLACE FUNCTION public.change_social_media_access_level(p_access_id uuid, p_access_level text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.social_media_access%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.social_media_access WHERE id = p_access_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Access not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_approve_social_media(auth.uid(), r.company_id) THEN
    RAISE EXCEPTION 'Only a manager or admin of this company can change access' USING ERRCODE = '42501';
  END IF;
  IF r.user_id = auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'You can''t change your own access';
  END IF;
  IF r.status <> 'active' THEN RAISE EXCEPTION 'Only active access can be changed'; END IF;
  IF p_access_level NOT IN ('admin', 'editor', 'viewer', 'analyst') THEN
    RAISE EXCEPTION 'Unknown access level %', p_access_level;
  END IF;
  IF p_access_level = r.access_level THEN RETURN; END IF;
  UPDATE public.social_media_access SET access_level = p_access_level WHERE id = p_access_id;
  PERFORM public.log_social_media(r.company_id, r.account_id, 'access_level_changed',
    jsonb_build_object('access_id', r.id, 'user_id', r.user_id, 'old_level', r.access_level, 'new_level', p_access_level));
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_social_media_access(p_access_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.social_media_access%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.social_media_access WHERE id = p_access_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Access not found' USING ERRCODE = 'P0002'; END IF;
  -- Approvers revoke; the requester may withdraw their own pending request.
  IF NOT (public.can_approve_social_media(auth.uid(), r.company_id)
          OR (r.status = 'pending' AND r.requested_by = auth.uid())) THEN
    RAISE EXCEPTION 'Only a manager or admin of this company can revoke access' USING ERRCODE = '42501';
  END IF;
  IF r.status NOT IN ('pending', 'active', 'nda_expired') THEN
    RAISE EXCEPTION 'This access is already %', r.status;
  END IF;
  UPDATE public.social_media_access
     SET status = 'revoked', access_revoked_at = now(), decided_by = auth.uid(), decided_at = now(),
         decision_note = NULLIF(btrim(COALESCE(p_note, '')), '')
   WHERE id = p_access_id;
  PERFORM public.log_social_media(r.company_id, r.account_id, 'access_revoked',
    jsonb_build_object('access_id', r.id, 'user_id', r.user_id, 'was', r.status, 'note', NULLIF(btrim(COALESCE(p_note, '')), '')));
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. NDAs
-- ─────────────────────────────────────────────────────────────────────────────
-- p_document_path: the uploaded file, "<company_id>/<access_id>/<file>" in the
-- social-media-nda-documents bucket.
CREATE OR REPLACE FUNCTION public.record_social_media_nda(
  p_access_id uuid,
  p_signed_on date,
  p_expiry_date date,
  p_version text,
  p_witness_name text,
  p_document_path text,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.social_media_access%ROWTYPE;
  v_current public.social_media_ndas%ROWTYPE;
  v_id uuid;
  v_path text := NULLIF(btrim(COALESCE(p_document_path, '')), '');
BEGIN
  SELECT * INTO r FROM public.social_media_access WHERE id = p_access_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_access_company(r.company_id) THEN
    RAISE EXCEPTION 'Access not found' USING ERRCODE = 'P0002';
  END IF;
  IF r.status NOT IN ('pending', 'active', 'nda_expired') THEN
    RAISE EXCEPTION 'This access is %, so no NDA is needed', r.status;
  END IF;
  IF v_path IS NULL THEN RAISE EXCEPTION 'Attach the signed NDA'; END IF;
  IF split_part(v_path, '/', 1) <> r.company_id::text THEN
    RAISE EXCEPTION 'The NDA document must be uploaded to this company''s folder';
  END IF;
  IF p_signed_on IS NULL OR p_signed_on > CURRENT_DATE THEN
    RAISE EXCEPTION 'Enter the date the NDA was signed (not in the future)';
  END IF;
  IF p_expiry_date IS NOT NULL AND p_expiry_date <= p_signed_on THEN
    RAISE EXCEPTION 'The expiry date must be after the signing date';
  END IF;
  IF p_expiry_date IS NOT NULL AND p_expiry_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'This NDA has already expired';
  END IF;

  v_current := public.social_media_current_nda(p_access_id);
  IF v_current.id IS NOT NULL AND NOT v_current.nda_signed THEN
    UPDATE public.social_media_ndas
       SET nda_signed = true, nda_signed_at = p_signed_on::timestamptz, nda_expiry_date = p_expiry_date,
           nda_version = COALESCE(NULLIF(btrim(p_version), ''), '1.0'),
           witness_name = NULLIF(btrim(COALESCE(p_witness_name, '')), ''),
           nda_document_url = v_path, notes = NULLIF(btrim(COALESCE(p_notes, '')), ''), user_id = r.user_id,
           updated_at = now()
     WHERE id = v_current.id
    RETURNING id INTO v_id;
  ELSE
    -- A renewal is a new record, so the history of signed NDAs is kept.
    INSERT INTO public.social_media_ndas (company_id, access_id, user_id, nda_signed, nda_signed_at, nda_expiry_date,
                                          nda_version, witness_name, nda_document_url, notes)
    VALUES (r.company_id, r.id, r.user_id, true, p_signed_on::timestamptz, p_expiry_date,
            COALESCE(NULLIF(btrim(p_version), ''), '1.0'), NULLIF(btrim(COALESCE(p_witness_name, '')), ''),
            v_path, NULLIF(btrim(COALESCE(p_notes, '')), ''))
    RETURNING id INTO v_id;
  END IF;

  PERFORM public.log_social_media(r.company_id, r.account_id, 'nda_signed',
    jsonb_build_object('access_id', r.id, 'user_id', r.user_id, 'expires', p_expiry_date, 'version', p_version));

  -- Access suspended for an expired NDA comes back with the renewed one.
  IF r.status = 'nda_expired' THEN
    UPDATE public.social_media_access SET status = 'active' WHERE id = r.id;
    PERFORM public.log_social_media(r.company_id, r.account_id, 'access_restored',
      jsonb_build_object('access_id', r.id, 'user_id', r.user_id));
  END IF;
  RETURN v_id;
END;
$$;

-- Nightly: suspend access whose NDA has expired.
CREATE OR REPLACE FUNCTION public.run_social_media_nda_expiry()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT a.id, a.company_id, a.account_id, a.user_id, n.nda_expiry_date
      FROM public.social_media_access a
      CROSS JOIN LATERAL public.social_media_current_nda(a.id) n
     WHERE a.status = 'active'
       AND n.id IS NOT NULL
       AND n.nda_signed
       AND n.nda_expiry_date < CURRENT_DATE
  LOOP
    UPDATE public.social_media_access SET status = 'nda_expired' WHERE id = r.id;
    INSERT INTO public.social_media_activity_log (company_id, account_id, action, performed_by, details)
    VALUES (r.company_id, r.account_id, 'nda_expired', NULL,
            jsonb_build_object('access_id', r.id, 'user_id', r.user_id, 'expired_on', r.nda_expiry_date));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'social-media-nda-expiry-daily';
    PERFORM cron.schedule('social-media-nda-expiry-daily', '45 0 * * *', $job$ SELECT public.run_social_media_nda_expiry(); $job$);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Account changes are logged by the database
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_social_media_account_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_changed text[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_social_media(NEW.company_id, NEW.id, 'account_added',
      jsonb_build_object('platform', NEW.platform, 'account_name', NEW.account_name));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_social_media(NEW.company_id, NEW.id,
      CASE WHEN NEW.status IN ('inactive', 'suspended', 'archived') THEN 'account_deactivated' ELSE 'account_status_changed' END,
      jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;

  SELECT array_agg(k) INTO v_changed
    FROM jsonb_each(to_jsonb(NEW)) n(k, v)
   WHERE k NOT IN ('status', 'updated_at', 'follower_count', 'created_at')
     AND n.v IS DISTINCT FROM (to_jsonb(OLD) -> k);
  IF v_changed IS NOT NULL THEN
    PERFORM public.log_social_media(NEW.company_id, NEW.id, 'account_updated', jsonb_build_object('fields', to_jsonb(v_changed)));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_social_media_account_change ON public.social_media_accounts;
CREATE TRIGGER trg_log_social_media_account_change
  AFTER INSERT OR UPDATE ON public.social_media_accounts
  FOR EACH ROW EXECUTE FUNCTION public.log_social_media_account_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Direct writes closed; storage by company folder
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Company users can insert social media access" ON public.social_media_access;
DROP POLICY IF EXISTS "Company users can update social media access" ON public.social_media_access;
DROP POLICY IF EXISTS "Company users can insert social media ndas" ON public.social_media_ndas;
DROP POLICY IF EXISTS "Company users can update social media ndas" ON public.social_media_ndas;
DROP POLICY IF EXISTS "Company users can insert activity log" ON public.social_media_activity_log;

DROP POLICY IF EXISTS "Company users can view NDA documents" ON storage.objects;
CREATE POLICY "Company users can view NDA documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'social-media-nda-documents'
         AND (public.is_admin(auth.uid()) OR public.can_access_company(((storage.foldername(name))[1])::uuid)));

DROP POLICY IF EXISTS "Company users can upload NDA documents" ON storage.objects;
CREATE POLICY "Company users can upload NDA documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'social-media-nda-documents'
              AND public.can_access_company(((storage.foldername(name))[1])::uuid));

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.log_social_media(uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_social_media_nda_expiry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_social_media_nda_expiry() TO service_role;
REVOKE ALL ON FUNCTION public.can_approve_social_media(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_approve_social_media(uuid, uuid) TO authenticated;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.social_media_rights(uuid)',
    'public.social_media_nda_valid(uuid)',
    'public.social_media_company_users(uuid)',
    'public.request_social_media_access(uuid, uuid, text, text)',
    'public.social_media_access_block_reason(uuid)',
    'public.decide_social_media_access(uuid, boolean, text)',
    'public.change_social_media_access_level(uuid, text)',
    'public.revoke_social_media_access(uuid, text)',
    'public.record_social_media_nda(uuid, date, date, text, text, text, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- Suspend anything already past its NDA.
SELECT public.run_social_media_nda_expiry();

-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only check after applying:
--   SELECT
--     (SELECT count(*) FROM pg_proc WHERE proname IN ('request_social_media_access', 'decide_social_media_access',
--        'record_social_media_nda', 'run_social_media_nda_expiry', 'social_media_company_users')) AS functions,  -- 5
--     (SELECT count(*) FROM public.social_media_access a
--       WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = a.user_id)) AS access_without_login,  -- 0
--     (SELECT count(*) FROM public.social_media_access WHERE status = 'active') AS active_access,
--     (SELECT count(*) FROM public.social_media_access WHERE status = 'nda_expired') AS suspended_for_nda;
-- ─────────────────────────────────────────────────────────────────────────────
