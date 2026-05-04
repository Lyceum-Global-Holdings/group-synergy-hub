-- MFA recovery codes table
CREATE TABLE public.user_mfa_recovery_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_mfa_recovery_codes_user ON public.user_mfa_recovery_codes(user_id) WHERE consumed_at IS NULL;
CREATE UNIQUE INDEX idx_user_mfa_recovery_codes_hash ON public.user_mfa_recovery_codes(user_id, code_hash);

ALTER TABLE public.user_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Users can read metadata about their own recovery codes (not the hashes themselves are sensitive but acceptable)
CREATE POLICY "Users view own recovery codes"
ON public.user_mfa_recovery_codes
FOR SELECT
USING (auth.uid() = user_id);

-- No direct INSERT/UPDATE/DELETE — only via SECURITY DEFINER functions

-- Generate 10 new recovery codes; deletes existing unconsumed ones; returns plaintext codes (only chance to see them).
CREATE OR REPLACE FUNCTION public.generate_mfa_recovery_codes()
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_codes TEXT[] := ARRAY[]::TEXT[];
  v_code TEXT;
  v_aal TEXT;
  i INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Require AAL2 (i.e., user already passed TOTP) before generating recovery codes
  v_aal := (auth.jwt() ->> 'aal');
  IF v_aal IS DISTINCT FROM 'aal2' THEN
    RAISE EXCEPTION 'AAL2 required to generate recovery codes';
  END IF;

  -- Invalidate prior codes
  DELETE FROM public.user_mfa_recovery_codes WHERE user_id = v_user;

  FOR i IN 1..10 LOOP
    -- 10-char base32-ish code formatted as XXXXX-XXXXX
    v_code := upper(
      substring(encode(gen_random_bytes(8), 'hex') from 1 for 5)
      || '-' ||
      substring(encode(gen_random_bytes(8), 'hex') from 1 for 5)
    );
    v_codes := array_append(v_codes, v_code);

    INSERT INTO public.user_mfa_recovery_codes (user_id, code_hash)
    VALUES (v_user, encode(digest(v_code || v_user::text, 'sha256'), 'hex'));
  END LOOP;

  RETURN v_codes;
END;
$$;

-- Consume a recovery code; returns true if matched & marked consumed.
CREATE OR REPLACE FUNCTION public.consume_mfa_recovery_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_hash TEXT;
  v_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_hash := encode(digest(upper(trim(p_code)) || v_user::text, 'sha256'), 'hex');

  UPDATE public.user_mfa_recovery_codes
  SET consumed_at = now()
  WHERE user_id = v_user
    AND code_hash = v_hash
    AND consumed_at IS NULL
  RETURNING id INTO v_id;

  RETURN v_id IS NOT NULL;
END;
$$;

-- Ensure pgcrypto is available for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

GRANT EXECUTE ON FUNCTION public.generate_mfa_recovery_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_mfa_recovery_code(TEXT) TO authenticated;