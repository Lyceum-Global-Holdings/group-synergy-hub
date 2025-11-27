-- Fix Function Search Path Mutable security issue
-- Add search_path = public to all functions that are missing it

-- 1. validate_journal_entry_balance
CREATE OR REPLACE FUNCTION public.validate_journal_entry_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  total_debit NUMERIC;
  total_credit NUMERIC;
BEGIN
  SELECT 
    COALESCE(SUM(debit_amount), 0),
    COALESCE(SUM(credit_amount), 0)
  INTO total_debit, total_credit
  FROM journal_entry_lines
  WHERE journal_entry_id = NEW.id;
  
  IF total_debit != total_credit THEN
    RAISE EXCEPTION 'Journal entry is not balanced. Debit: %, Credit: %', total_debit, total_credit;
  END IF;
  
  NEW.is_balanced := true;
  RETURN NEW;
END;
$function$;

-- 2. update_account_balances_on_post
CREATE OR REPLACE FUNCTION public.update_account_balances_on_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Update current balance for all accounts in this JE
  UPDATE chart_of_accounts coa
  SET 
    current_balance = CASE 
      WHEN coa.normal_balance = 'debit' 
      THEN coa.opening_balance + (
        SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0)
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE jel.account_id = coa.id AND je.status = 'posted'
      )
      ELSE coa.opening_balance + (
        SELECT COALESCE(SUM(jel.credit_amount - jel.debit_amount), 0)
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE jel.account_id = coa.id AND je.status = 'posted'
      )
    END,
    updated_at = now()
  WHERE coa.id IN (
    SELECT account_id FROM journal_entry_lines WHERE journal_entry_id = NEW.id
  );
  
  RETURN NEW;
END;
$function$;

-- 3. check_period_status
CREATE OR REPLACE FUNCTION public.check_period_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  period_stat period_status;
BEGIN
  IF NEW.period_id IS NOT NULL THEN
    SELECT status INTO period_stat
    FROM accounting_periods
    WHERE id = NEW.period_id;
    
    IF period_stat IN ('closed', 'locked') THEN
      RAISE EXCEPTION 'Cannot post to a closed or locked period';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. validate_po_for_grn
CREATE OR REPLACE FUNCTION public.validate_po_for_grn(p_po_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM purchase_orders
  WHERE id = p_po_id;
  
  -- Only allow GRN creation for approved/sent/acknowledged/partially_received POs
  RETURN v_status IN ('approved', 'sent', 'acknowledged', 'partially_received');
END;
$function$;

-- 5. update_po_item_quantities
CREATE OR REPLACE FUNCTION public.update_po_item_quantities()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Update quantity_pending when quantity_received changes
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    NEW.quantity_pending := NEW.quantity_ordered - NEW.quantity_received;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 6. update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 7. auto_generate_asset_id
CREATE OR REPLACE FUNCTION public.auto_generate_asset_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Generate asset_id if not provided
  IF NEW.asset_id IS NULL OR NEW.asset_id = '' THEN
    NEW.asset_id := generate_asset_id(NEW.category_id, NEW.subcategory_id, NEW.brand);
  END IF;
  
  RETURN NEW;
END;
$function$;