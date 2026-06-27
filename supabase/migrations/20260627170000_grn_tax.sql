-- GRN tax: a document tax (percent or fixed) applied on the NET total (after
-- discounts). Tax is a recoverable input tax (IAS 2) — it is NOT part of the
-- inventory landed cost; it only adds a payable grand_total. So net_unit_price
-- and inventory valuation are unchanged.

ALTER TABLE public.goods_receipt_notes
  ADD COLUMN IF NOT EXISTS tax_type text CHECK (tax_type IN ('percent','fixed')),
  ADD COLUMN IF NOT EXISTS tax_value numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grand_total numeric(15,2) NOT NULL DEFAULT 0;

-- Extend the costing engine: compute tax on the net total + grand_total.
CREATE OR REPLACE FUNCTION public.recompute_grn_totals(p_grn_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dtype      text;
  v_dval       numeric;
  v_ttype      text;
  v_tval       numeric;
  v_ids        uuid[]    := '{}';
  v_qtys       numeric[] := '{}';
  v_nets       numeric[] := '{}';
  v_subtotal   numeric   := 0;
  v_after_line numeric   := 0;
  v_doc_disc   numeric   := 0;
  v_alloc_sum  numeric   := 0;
  v_net_total  numeric   := 0;
  v_tax        numeric   := 0;
  r            record;
  i            int;
  n            int;
  v_alloc      numeric;
  v_final      numeric;
BEGIN
  SELECT discount_type, COALESCE(discount_value, 0),
         tax_type, COALESCE(tax_value, 0)
    INTO v_dtype, v_dval, v_ttype, v_tval
    FROM public.goods_receipt_notes WHERE id = p_grn_id;

  -- Pass 1: line gross, line discount, line net (document order).
  FOR r IN
    SELECT id, COALESCE(quantity_received, 0) AS qty, COALESCE(unit_price, 0) AS up,
           discount_type AS ld_type, COALESCE(discount_value, 0) AS ld_val
    FROM public.grn_items WHERE grn_id = p_grn_id
    ORDER BY created_at, id
  LOOP
    DECLARE
      g  numeric := r.qty * r.up;
      ld numeric;
      ln numeric;
    BEGIN
      ld := CASE r.ld_type WHEN 'percent' THEN g * r.ld_val / 100
                           WHEN 'fixed'   THEN r.ld_val ELSE 0 END;
      ld := LEAST(GREATEST(ld, 0), g);
      ln := g - ld;
      UPDATE public.grn_items SET line_discount_amount = ROUND(ld, 2) WHERE id = r.id;
      v_ids := v_ids || r.id; v_qtys := v_qtys || r.qty; v_nets := v_nets || ln;
      v_subtotal := v_subtotal + g; v_after_line := v_after_line + ln;
    END;
  END LOOP;

  -- Overall discount on the after-line subtotal.
  v_doc_disc := CASE v_dtype WHEN 'percent' THEN v_after_line * v_dval / 100
                             WHEN 'fixed'   THEN v_dval ELSE 0 END;
  v_doc_disc := LEAST(GREATEST(v_doc_disc, 0), v_after_line);

  -- Pass 2: allocate the overall discount proportionally; last line takes the
  -- rounding remainder so the allocations reconcile exactly.
  n := array_length(v_ids, 1);
  IF n IS NOT NULL THEN
    FOR i IN 1..n LOOP
      IF i < n AND v_after_line > 0 THEN
        v_alloc := ROUND(v_doc_disc * v_nets[i] / v_after_line, 2);
      ELSIF i = n THEN
        v_alloc := ROUND(v_doc_disc - v_alloc_sum, 2);
      ELSE
        v_alloc := 0;
      END IF;
      v_alloc_sum := v_alloc_sum + v_alloc;
      v_final := ROUND(v_nets[i] - v_alloc, 2);
      UPDATE public.grn_items
         SET total_cost     = v_final,
             net_unit_price = CASE WHEN v_qtys[i] > 0 THEN ROUND(v_final / v_qtys[i], 6) ELSE 0 END,
             updated_at     = now()
       WHERE id = v_ids[i];
    END LOOP;
  END IF;

  v_net_total := ROUND(v_after_line - v_doc_disc, 2);

  -- Tax on the net total (recoverable; excluded from inventory cost).
  v_tax := CASE v_ttype WHEN 'percent' THEN v_net_total * v_tval / 100
                        WHEN 'fixed'   THEN v_tval ELSE 0 END;
  v_tax := GREATEST(v_tax, 0);

  UPDATE public.goods_receipt_notes
     SET subtotal_value  = ROUND(v_subtotal, 2),
         discount_amount = ROUND(v_doc_disc, 2),
         total_value     = v_net_total,
         tax_amount      = ROUND(v_tax, 2),
         grand_total     = ROUND(v_net_total + v_tax, 2),
         updated_at      = now()
   WHERE id = p_grn_id;
END;
$$;

-- Header recompute trigger must also fire on tax changes.
DROP TRIGGER IF EXISTS trg_grn_header_recompute ON public.goods_receipt_notes;
CREATE TRIGGER trg_grn_header_recompute
  AFTER UPDATE OF discount_type, discount_value, tax_type, tax_value ON public.goods_receipt_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_grn_recompute_from_header();

-- Backfill payable grand_total for existing GRNs (no tax → grand = net).
UPDATE public.goods_receipt_notes SET grand_total = COALESCE(total_value, 0)
 WHERE grand_total = 0;
