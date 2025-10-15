-- Create trigger function to auto-generate GRN number
CREATE OR REPLACE FUNCTION public.auto_generate_grn_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.grn_number IS NULL OR NEW.grn_number = '' THEN
    NEW.grn_number := generate_grn_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_generate_grn_number_trigger ON public.goods_receipt_notes;

-- Create trigger to auto-generate GRN number on insert
CREATE TRIGGER auto_generate_grn_number_trigger
BEFORE INSERT ON public.goods_receipt_notes
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_grn_number();