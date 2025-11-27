-- Fix remaining functions with mutable search_path
-- These functions need explicit search_path setting for security

-- 1. calculate_je_totals - missing search_path
CREATE OR REPLACE FUNCTION public.calculate_je_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE journal_entries
  SET 
    total_debit = (SELECT COALESCE(SUM(debit_amount), 0) FROM journal_entry_lines WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id)),
    total_credit = (SELECT COALESCE(SUM(credit_amount), 0) FROM journal_entry_lines WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id)),
    updated_at = now()
  WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2. update_batch_totals - has search_path but needs SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.update_batch_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.stock_adjustment_batches
  SET 
    total_items = (SELECT COUNT(*) FROM stock_transactions WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)),
    total_value_impact = (SELECT COALESCE(SUM(total_value), 0) FROM stock_transactions WHERE batch_id = COALESCE(NEW.batch_id, OLD.batch_id)),
    updated_at = now()
  WHERE id = COALESCE(NEW.batch_id, OLD.batch_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;