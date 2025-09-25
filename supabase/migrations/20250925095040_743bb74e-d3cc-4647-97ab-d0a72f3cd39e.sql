-- Fix function search path security issue
CREATE OR REPLACE FUNCTION sync_finished_goods_sizes()
RETURNS TRIGGER AS $$
BEGIN
  -- If available_sizes is updated and not empty, update size field with first item
  IF NEW.available_sizes IS NOT NULL AND jsonb_array_length(NEW.available_sizes) > 0 THEN
    NEW.size := NEW.available_sizes->>0;
  END IF;
  
  -- If size is updated and available_sizes is empty, populate available_sizes
  IF NEW.size IS NOT NULL AND NEW.size != '' AND (NEW.available_sizes IS NULL OR jsonb_array_length(NEW.available_sizes) = 0) THEN
    NEW.available_sizes := jsonb_build_array(NEW.size);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;