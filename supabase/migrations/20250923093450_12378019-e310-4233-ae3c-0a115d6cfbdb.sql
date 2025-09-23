-- Add trigger to auto-generate BOM number
CREATE OR REPLACE FUNCTION public.auto_generate_bom_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if bom_number is not already set
  IF NEW.bom_number IS NULL OR NEW.bom_number = '' THEN
    NEW.bom_number := generate_bom_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for bill_of_materials table
DROP TRIGGER IF EXISTS trigger_auto_generate_bom_number ON public.bill_of_materials;
CREATE TRIGGER trigger_auto_generate_bom_number
  BEFORE INSERT ON public.bill_of_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_bom_number();