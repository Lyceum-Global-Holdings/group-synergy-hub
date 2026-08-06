-- Sales suite: Services catalog, Quotations, and line-item invoicing.
--
-- • services — what a company sells. Rows with company_id IS NULL are GENERIC
--   TEMPLATES visible to every company; "customizing" one clones it into the
--   company (template_id keeps provenance) with its own name/price. Template
--   edits never silently change a company's pricing.
-- • service_price_history — every master-price change recorded (ISO 9001-style
--   traceability for price decisions).
-- • sales_quotations + items — quote lines default to the service price but
--   are freely overridable; list_price is snapshotted per line so the UI can
--   show variance vs list. Totals recompute server-side (same engine shape as
--   the GRN costing). Workflow: draft → sent → accepted/rejected/expired,
--   then → invoiced via conversion.
-- • customer_invoice_items + customer_invoices.quotation_id — Sales invoices
--   EXTEND the existing AR invoice ledger instead of duplicating it, so
--   receipts / partial payments / aging keep working unchanged.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Services
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.services (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code  text NOT NULL UNIQUE,
  name          text NOT NULL,
  description   text,
  category      text,
  unit          text NOT NULL DEFAULT 'job',
  default_price numeric(15,2) NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  template_id   uuid REFERENCES public.services(id) ON DELETE SET NULL,
  company_id    uuid REFERENCES public.companies(id) ON DELETE CASCADE, -- NULL = generic template
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_services_company ON public.services(company_id);

DROP TRIGGER IF EXISTS trg_services_updated_at ON public.services;
CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_service_code()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE next_number integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(service_code FROM 'SVC-(.*)') AS integer)), 0) + 1
    INTO next_number FROM public.services WHERE service_code LIKE 'SVC-%';
  RETURN 'SVC-' || LPAD(next_number::text, 4, '0');
END;
$$;

-- Auto-assign the code when omitted.
CREATE OR REPLACE FUNCTION public.set_service_code()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.service_code IS NULL OR btrim(NEW.service_code) = '' THEN
    NEW.service_code := public.generate_service_code();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_service_code ON public.services;
CREATE TRIGGER trg_set_service_code
  BEFORE INSERT ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_service_code();

-- Price history (auto-logged on master price change).
CREATE TABLE IF NOT EXISTS public.service_price_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  old_price  numeric(15,2),
  new_price  numeric(15,2) NOT NULL,
  changed_by uuid,
  company_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_price_history_service
  ON public.service_price_history(service_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.trg_service_price_log()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.default_price IS DISTINCT FROM OLD.default_price THEN
    INSERT INTO public.service_price_history(service_id, old_price, new_price, changed_by, company_id)
    VALUES (NEW.id, OLD.default_price, NEW.default_price, auth.uid(), NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_service_price_log ON public.services;
CREATE TRIGGER trg_service_price_log
  AFTER UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trg_service_price_log();

-- Clone a generic template into a company for customization.
CREATE OR REPLACE FUNCTION public.customize_service_template(p_template_id uuid, p_company_id uuid)
RETURNS public.services
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_tpl public.services;
  v_new public.services;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.can_access_company(p_company_id) THEN
    RAISE EXCEPTION 'Not authorised for this company';
  END IF;
  SELECT * INTO v_tpl FROM public.services WHERE id = p_template_id AND company_id IS NULL;
  IF v_tpl IS NULL THEN RAISE EXCEPTION 'Generic service template not found'; END IF;

  -- Idempotent: one customization per template per company.
  SELECT * INTO v_new FROM public.services
   WHERE template_id = p_template_id AND company_id = p_company_id LIMIT 1;
  IF v_new.id IS NOT NULL THEN RETURN v_new; END IF;

  INSERT INTO public.services(name, description, category, unit, default_price,
                              is_active, template_id, company_id, created_by)
  VALUES (v_tpl.name, v_tpl.description, v_tpl.category, v_tpl.unit, v_tpl.default_price,
          true, p_template_id, p_company_id, auth.uid())
  RETURNING * INTO v_new;
  RETURN v_new;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Quotations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_quotations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number    text NOT NULL UNIQUE,
  customer_id     uuid REFERENCES public.customers(id),
  quote_date      date NOT NULL DEFAULT CURRENT_DATE,
  valid_until     date,
  status          text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','accepted','rejected','expired','invoiced')),
  subtotal        numeric(15,2) NOT NULL DEFAULT 0,
  discount_type   text CHECK (discount_type IN ('percent','fixed')),
  discount_value  numeric(15,2) NOT NULL DEFAULT 0,
  discount_amount numeric(15,2) NOT NULL DEFAULT 0,
  tax_type        text CHECK (tax_type IN ('percent','fixed')),
  tax_value       numeric(15,2) NOT NULL DEFAULT 0,
  tax_amount      numeric(15,2) NOT NULL DEFAULT 0,
  total_amount    numeric(15,2) NOT NULL DEFAULT 0,
  payment_terms   text,
  notes           text,
  terms           text,
  invoice_id      uuid REFERENCES public.customer_invoices(id),
  sent_at         timestamptz,
  decided_at      timestamptz,
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_quotations_company ON public.sales_quotations(company_id, quote_date DESC);

DROP TRIGGER IF EXISTS trg_sales_quotations_updated_at ON public.sales_quotations;
CREATE TRIGGER trg_sales_quotations_updated_at
  BEFORE UPDATE ON public.sales_quotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_quotation_number()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE next_number integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 'QTN-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-(.*)') AS integer)), 0) + 1
    INTO next_number FROM public.sales_quotations
   WHERE quote_number LIKE 'QTN-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-%';
  RETURN 'QTN-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-' || LPAD(next_number::text, 3, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS public.sales_quotation_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id  uuid NOT NULL REFERENCES public.sales_quotations(id) ON DELETE CASCADE,
  service_id    uuid REFERENCES public.services(id) ON DELETE SET NULL,
  item_name     text NOT NULL,
  description   text,
  unit          text NOT NULL DEFAULT 'job',
  quantity      numeric(15,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price    numeric(15,2) NOT NULL DEFAULT 0,
  list_price    numeric(15,2),          -- service master price at quote time (variance display)
  line_total    numeric(15,2) NOT NULL DEFAULT 0,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_quotation_items_q ON public.sales_quotation_items(quotation_id);

-- Server-side totals (line totals → doc discount → tax → grand total).
CREATE OR REPLACE FUNCTION public.recompute_quotation_totals(p_quotation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_dtype text; v_dval numeric; v_ttype text; v_tval numeric;
  v_subtotal numeric := 0; v_disc numeric := 0; v_net numeric := 0; v_tax numeric := 0;
BEGIN
  UPDATE public.sales_quotation_items
     SET line_total = ROUND(quantity * unit_price, 2)
   WHERE quotation_id = p_quotation_id;

  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
    FROM public.sales_quotation_items WHERE quotation_id = p_quotation_id;

  SELECT discount_type, COALESCE(discount_value,0), tax_type, COALESCE(tax_value,0)
    INTO v_dtype, v_dval, v_ttype, v_tval
    FROM public.sales_quotations WHERE id = p_quotation_id;

  v_disc := CASE v_dtype WHEN 'percent' THEN v_subtotal * v_dval / 100
                         WHEN 'fixed'   THEN v_dval ELSE 0 END;
  v_disc := LEAST(GREATEST(v_disc, 0), v_subtotal);
  v_net  := v_subtotal - v_disc;
  v_tax  := CASE v_ttype WHEN 'percent' THEN v_net * v_tval / 100
                         WHEN 'fixed'   THEN v_tval ELSE 0 END;
  v_tax  := GREATEST(v_tax, 0);

  UPDATE public.sales_quotations
     SET subtotal = ROUND(v_subtotal,2), discount_amount = ROUND(v_disc,2),
         tax_amount = ROUND(v_tax,2), total_amount = ROUND(v_net + v_tax,2),
         updated_at = now()
   WHERE id = p_quotation_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Invoice line items on the EXISTING AR ledger
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.customer_invoices
  ADD COLUMN IF NOT EXISTS quotation_id uuid REFERENCES public.sales_quotations(id);

CREATE TABLE IF NOT EXISTS public.customer_invoice_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  service_id  uuid REFERENCES public.services(id) ON DELETE SET NULL,
  item_name   text NOT NULL,
  description text,
  unit        text NOT NULL DEFAULT 'job',
  quantity    numeric(15,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  numeric(15,2) NOT NULL DEFAULT 0,
  line_total  numeric(15,2) NOT NULL DEFAULT 0,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_invoice_items_inv ON public.customer_invoice_items(invoice_id);

CREATE OR REPLACE FUNCTION public.generate_sales_invoice_number()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE next_number integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'INV-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-(.*)') AS integer)), 0) + 1
    INTO next_number FROM public.customer_invoices
   WHERE invoice_number LIKE 'INV-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-%';
  RETURN 'INV-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-' || LPAD(next_number::text, 3, '0');
END;
$$;

-- Line-derived totals for the AR header (gross = after discount; net = gross + tax).
CREATE OR REPLACE FUNCTION public.recompute_customer_invoice_totals(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_gross numeric := 0; v_tax numeric := 0;
BEGIN
  UPDATE public.customer_invoice_items
     SET line_total = ROUND(quantity * unit_price, 2)
   WHERE invoice_id = p_invoice_id;

  SELECT COALESCE(SUM(line_total),0) INTO v_gross
    FROM public.customer_invoice_items WHERE invoice_id = p_invoice_id;

  SELECT COALESCE(tax_amount,0) INTO v_tax
    FROM public.customer_invoices WHERE id = p_invoice_id;

  UPDATE public.customer_invoices
     SET gross_amount = ROUND(v_gross,2),
         net_amount   = ROUND(v_gross + v_tax,2),
         updated_at   = now()
   WHERE id = p_invoice_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Quote → Invoice conversion (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.convert_quotation_to_invoice(p_quotation_id uuid)
RETURNS public.customer_invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_q   public.sales_quotations;
  v_inv public.customer_invoices;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_q FROM public.sales_quotations WHERE id = p_quotation_id FOR UPDATE;
  IF v_q.id IS NULL THEN RAISE EXCEPTION 'Quotation not found'; END IF;
  IF NOT public.can_access_company(v_q.company_id) THEN
    RAISE EXCEPTION 'Not authorised for this quotation';
  END IF;
  IF v_q.invoice_id IS NOT NULL THEN
    SELECT * INTO v_inv FROM public.customer_invoices WHERE id = v_q.invoice_id;
    RETURN v_inv;  -- already converted
  END IF;
  IF v_q.status NOT IN ('accepted','sent') THEN
    RAISE EXCEPTION 'Only sent or accepted quotations can be invoiced (current: %)', v_q.status;
  END IF;

  INSERT INTO public.customer_invoices(
    invoice_number, customer_id, invoice_date, due_date,
    gross_amount, tax_amount, net_amount, status,
    payment_terms, currency, quotation_id, notes, company_id, created_by)
  VALUES (
    public.generate_sales_invoice_number(), v_q.customer_id, CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    v_q.subtotal - v_q.discount_amount, v_q.tax_amount, v_q.total_amount, 'draft',
    v_q.payment_terms, 'LKR', v_q.id,
    'Generated from quotation ' || v_q.quote_number, v_q.company_id, auth.uid())
  RETURNING * INTO v_inv;

  INSERT INTO public.customer_invoice_items(
    invoice_id, service_id, item_name, description, unit, quantity, unit_price, line_total, sort_order)
  SELECT v_inv.id, service_id, item_name, description, unit, quantity, unit_price, line_total, sort_order
    FROM public.sales_quotation_items
   WHERE quotation_id = p_quotation_id
   ORDER BY sort_order, created_at;

  UPDATE public.sales_quotations
     SET status = 'invoiced', invoice_id = v_inv.id,
         decided_at = COALESCE(decided_at, now()), updated_at = now()
   WHERE id = p_quotation_id;

  RETURN v_inv;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.services               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_price_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quotations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quotation_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_invoice_items ENABLE ROW LEVEL SECURITY;

-- Services: generic templates readable by all; company rows company-scoped.
DROP POLICY IF EXISTS services_select ON public.services;
CREATE POLICY services_select ON public.services FOR SELECT TO authenticated
  USING (company_id IS NULL OR public.can_access_company(company_id));
DROP POLICY IF EXISTS services_insert ON public.services;
CREATE POLICY services_insert ON public.services FOR INSERT TO authenticated
  WITH CHECK ((company_id IS NULL AND public.is_admin(auth.uid()))
              OR (company_id IS NOT NULL AND public.can_access_company(company_id)));
DROP POLICY IF EXISTS services_update ON public.services;
CREATE POLICY services_update ON public.services FOR UPDATE TO authenticated
  USING ((company_id IS NULL AND public.is_admin(auth.uid()))
         OR (company_id IS NOT NULL AND public.can_access_company(company_id)))
  WITH CHECK ((company_id IS NULL AND public.is_admin(auth.uid()))
              OR (company_id IS NOT NULL AND public.can_access_company(company_id)));
DROP POLICY IF EXISTS services_delete ON public.services;
CREATE POLICY services_delete ON public.services FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS sph_select ON public.service_price_history;
CREATE POLICY sph_select ON public.service_price_history FOR SELECT TO authenticated
  USING (company_id IS NULL OR public.can_access_company(company_id));
DROP POLICY IF EXISTS sph_insert ON public.service_price_history;
CREATE POLICY sph_insert ON public.service_price_history FOR INSERT TO authenticated
  WITH CHECK (true);  -- written by SECURITY DEFINER trigger only

DROP POLICY IF EXISTS sq_select ON public.sales_quotations;
CREATE POLICY sq_select ON public.sales_quotations FOR SELECT TO authenticated
  USING (public.can_access_company(company_id));
DROP POLICY IF EXISTS sq_insert ON public.sales_quotations;
CREATE POLICY sq_insert ON public.sales_quotations FOR INSERT TO authenticated
  WITH CHECK (public.can_access_company(company_id));
DROP POLICY IF EXISTS sq_update ON public.sales_quotations;
CREATE POLICY sq_update ON public.sales_quotations FOR UPDATE TO authenticated
  USING (public.can_access_company(company_id))
  WITH CHECK (public.can_access_company(company_id));
DROP POLICY IF EXISTS sq_delete ON public.sales_quotations;
CREATE POLICY sq_delete ON public.sales_quotations FOR DELETE TO authenticated
  USING (public.can_access_company(company_id) AND status = 'draft');

DROP POLICY IF EXISTS sqi_all ON public.sales_quotation_items;
CREATE POLICY sqi_all ON public.sales_quotation_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales_quotations q
                  WHERE q.id = quotation_id AND public.can_access_company(q.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales_quotations q
                       WHERE q.id = quotation_id AND public.can_access_company(q.company_id)));

DROP POLICY IF EXISTS cii_all ON public.customer_invoice_items;
CREATE POLICY cii_all ON public.customer_invoice_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_invoices i
                  WHERE i.id = invoice_id AND public.can_access_company(i.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customer_invoices i
                       WHERE i.id = invoice_id AND public.can_access_company(i.company_id)));

GRANT EXECUTE ON FUNCTION public.generate_service_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_quotation_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_sales_invoice_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.customize_service_template(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_quotation_totals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_customer_invoice_totals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_quotation_to_invoice(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Seed generic service templates (idempotent by name among templates)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.services (name, description, category, unit, default_price, company_id)
SELECT s.name, s.descr, s.cat, s.unit, s.price, NULL
FROM (VALUES
  ('Consultation',        'Professional consultation session',            'Professional', 'hour',  5000.00),
  ('Installation',        'On-site installation service',                 'Field',        'job',  15000.00),
  ('Maintenance Visit',   'Scheduled maintenance / service visit',        'Field',        'visit', 8000.00),
  ('Delivery & Handling', 'Transport, delivery and handling',             'Logistics',    'trip',  6000.00),
  ('Labour — Hourly',     'General labour charged per hour',              'Labour',       'hour',  1500.00)
) AS s(name, descr, cat, unit, price)
WHERE NOT EXISTS (
  SELECT 1 FROM public.services t WHERE t.company_id IS NULL AND t.name = s.name
);
