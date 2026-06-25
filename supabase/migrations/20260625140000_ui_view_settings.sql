-- System-wide UI view settings (e.g. inventory column visibility).
-- Keyed by view so multiple tables can share the mechanism. Readable by every
-- authenticated user (so all users load the shared default); writable only by
-- super admins, via the set_ui_view_setting RPC.

CREATE TABLE IF NOT EXISTS public.ui_view_settings (
  view_key   text PRIMARY KEY,
  config     jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ui_view_settings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read the shared defaults.
DROP POLICY IF EXISTS ui_view_settings_read_all ON public.ui_view_settings;
CREATE POLICY ui_view_settings_read_all
  ON public.ui_view_settings FOR SELECT
  TO authenticated
  USING (true);

-- No direct INSERT/UPDATE policies: writes go through set_ui_view_setting() only.

-- Super-admin-only upsert of a shared view setting.
CREATE OR REPLACE FUNCTION public.set_ui_view_setting(p_view_key text, p_config jsonb)
RETURNS public.ui_view_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.ui_view_settings;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'Only super admins can set a system-wide view layout';
  END IF;
  IF p_view_key IS NULL OR length(btrim(p_view_key)) = 0 THEN
    RAISE EXCEPTION 'view_key is required';
  END IF;
  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'config must be a JSON object';
  END IF;

  INSERT INTO public.ui_view_settings (view_key, config, updated_by, updated_at)
  VALUES (btrim(p_view_key), p_config, v_uid, now())
  ON CONFLICT (view_key) DO UPDATE
    SET config     = EXCLUDED.config,
        updated_by = EXCLUDED.updated_by,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_ui_view_setting(text, jsonb) TO authenticated;
