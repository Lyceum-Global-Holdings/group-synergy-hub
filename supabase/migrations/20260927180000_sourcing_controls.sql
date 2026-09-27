-- Sourcing controls.
--
-- 1. The blacklist was not enforced: a blacklisted supplier could still be put
--    on a purchase order, blanket PO or RFQ invitation. The database now refuses
--    that. Orders already placed can still be received, cancelled or closed.
--
-- 2. Approving a supplier registration created the supplier but never allocated
--    it to the company, so it was missing from that company's PO supplier list.
--    Registrations now record the supplier they created, and approval allocates
--    it to the registration's company as approved. Earlier approvals are
--    backfilled where the supplier can be identified unambiguously.
--
-- 3. Supplier-portal roles: the invite form, the invite edge function and the
--    portal all use owner / admin / user / viewer, but the tables only allowed
--    owner / contributor / viewer — so "admin" and "user" (the default) invites
--    were rejected. 'contributor' becomes 'user'.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Blacklist enforcement
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.block_blacklisted_supplier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_status text := COALESCE(to_jsonb(NEW)->>'status', to_jsonb(NEW)->>'contract_status');
  v_old_status text;
  v_reason text;
BEGIN
  IF NEW.supplier_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- On updates, only check a new supplier or a step that moves the order
  -- towards the supplier. Receiving, cancelling and closing stay allowed.
  IF TG_OP = 'UPDATE' THEN
    v_old_status := COALESCE(to_jsonb(OLD)->>'status', to_jsonb(OLD)->>'contract_status');
    IF NEW.supplier_id IS NOT DISTINCT FROM OLD.supplier_id
       AND (v_new_status IS NOT DISTINCT FROM v_old_status
            OR v_new_status NOT IN ('pending_approval', 'pending_dept_head_approval', 'approved', 'sent', 'active')) THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT b.blacklist_reason INTO v_reason
  FROM public.supplier_blacklist b
  WHERE b.supplier_id = NEW.supplier_id
    AND b.status = 'blacklisted';

  IF FOUND THEN
    RAISE EXCEPTION 'This supplier is blacklisted (%). Clear it in Sourcing › Blacklist before using it.', v_reason
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_blacklisted_supplier ON public.purchase_orders;
CREATE TRIGGER trg_block_blacklisted_supplier
  BEFORE INSERT OR UPDATE OF supplier_id, status ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.block_blacklisted_supplier();

DROP TRIGGER IF EXISTS trg_block_blacklisted_supplier ON public.blanket_purchase_orders;
CREATE TRIGGER trg_block_blacklisted_supplier
  BEFORE INSERT OR UPDATE OF supplier_id, contract_status ON public.blanket_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.block_blacklisted_supplier();

DROP TRIGGER IF EXISTS trg_block_blacklisted_supplier ON public.rfq_rfp_invited_suppliers;
CREATE TRIGGER trg_block_blacklisted_supplier
  BEFORE INSERT OR UPDATE OF supplier_id ON public.rfq_rfp_invited_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.block_blacklisted_supplier();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Approved registrations are allocated to their company
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.supplier_registration_requests
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- SECURITY DEFINER: allocations are otherwise admin-only, but approving a
-- registration for a company is that company's decision to use the supplier.
CREATE OR REPLACE FUNCTION public.allocate_supplier_on_registration_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'
     AND NEW.supplier_id IS NOT NULL
     AND NEW.company_id IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR OLD.status IS DISTINCT FROM 'approved'
          OR OLD.supplier_id IS DISTINCT FROM NEW.supplier_id) THEN
    INSERT INTO public.company_suppliers (
      company_id, supplier_id, status, allocation_type,
      allocated_by, allocated_at, approved_by, approved_at
    ) VALUES (
      NEW.company_id, NEW.supplier_id, 'approved', 'auto',
      NEW.reviewed_by, now(), NEW.reviewed_by, now()
    )
    ON CONFLICT (company_id, supplier_id) DO UPDATE
      SET status = 'approved',
          approved_by = EXCLUDED.approved_by,
          approved_at = EXCLUDED.approved_at,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_allocate_supplier_on_registration_approval ON public.supplier_registration_requests;
CREATE TRIGGER trg_allocate_supplier_on_registration_approval
  AFTER INSERT OR UPDATE OF status, supplier_id ON public.supplier_registration_requests
  FOR EACH ROW EXECUTE FUNCTION public.allocate_supplier_on_registration_approval();

-- Backfill earlier approvals: link each approved registration to the supplier
-- it created (same company, same name, created at or after submission), but
-- only when exactly one supplier matches. The trigger above then allocates it.
WITH candidates AS (
  SELECT r.id AS registration_id, s.id AS supplier_id,
         count(*) OVER (PARTITION BY r.id) AS matches
  FROM public.supplier_registration_requests r
  JOIN public.suppliers s
    ON s.company_id = r.company_id
   AND lower(btrim(s.name)) = lower(btrim(COALESCE(r.supplier_data->>'supplier_name', r.supplier_data->>'name')))
   AND s.created_at >= COALESCE(r.submitted_at, r.created_at) - interval '1 day'
  WHERE r.status = 'approved'
    AND r.supplier_id IS NULL
    AND r.company_id IS NOT NULL
)
UPDATE public.supplier_registration_requests r
   SET supplier_id = c.supplier_id
  FROM candidates c
 WHERE c.registration_id = r.id
   AND c.matches = 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Supplier-portal roles: owner / admin / user / viewer
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  c record;
BEGIN
  FOREACH t IN ARRAY ARRAY['supplier_users', 'supplier_invitations'] LOOP
    -- Drop whatever CHECK currently limits portal_role (name-independent).
    FOR c IN
      SELECT con.conname
      FROM pg_constraint con
      WHERE con.conrelid = format('public.%I', t)::regclass
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) ILIKE '%portal_role%'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t, c.conname);
    END LOOP;

    EXECUTE format('UPDATE public.%I SET portal_role = %L WHERE portal_role = %L', t, 'user', 'contributor');

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (portal_role IN (''owner'', ''admin'', ''user'', ''viewer''))',
      t, t || '_portal_role_check');
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only check after applying:
--   SELECT
--     (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_block_blacklisted_supplier') AS blacklist_triggers,      -- 3
--     (SELECT count(*) FROM public.supplier_registration_requests r
--        WHERE r.status = 'approved' AND r.company_id IS NOT NULL AND r.supplier_id IS NULL) AS approvals_not_linked,  -- review these by hand
--     (SELECT count(*) FROM public.supplier_registration_requests r
--        JOIN public.company_suppliers cs ON cs.company_id = r.company_id AND cs.supplier_id = r.supplier_id
--        WHERE r.status = 'approved' AND cs.status = 'approved') AS approvals_allocated,
--     (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'supplier_users_portal_role_check') AS portal_roles;
-- ─────────────────────────────────────────────────────────────────────────────
