-- Add depreciation fields to asset_master table
ALTER TABLE asset_master
ADD COLUMN IF NOT EXISTS depreciation_method TEXT DEFAULT 'straight_line',
ADD COLUMN IF NOT EXISTS depreciation_rate NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS useful_life_years INTEGER,
ADD COLUMN IF NOT EXISTS salvage_value NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS purchase_date DATE,
ADD COLUMN IF NOT EXISTS accumulated_depreciation NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN asset_master.depreciation_method IS 'Depreciation method: straight_line, declining_balance';
COMMENT ON COLUMN asset_master.depreciation_rate IS 'Annual depreciation rate as percentage (e.g., 20 for 20%)';
COMMENT ON COLUMN asset_master.useful_life_years IS 'Expected useful life in years';
COMMENT ON COLUMN asset_master.salvage_value IS 'Expected residual value at end of useful life';

-- Add depreciation fields to warehouse_assets table
ALTER TABLE warehouse_assets
ADD COLUMN IF NOT EXISTS depreciation_method TEXT,
ADD COLUMN IF NOT EXISTS depreciation_rate NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS useful_life_years INTEGER,
ADD COLUMN IF NOT EXISTS salvage_value NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS accumulated_depreciation NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_depreciation_date DATE;

-- Create depreciation calculation function
CREATE OR REPLACE FUNCTION calculate_depreciation(
  p_purchase_price NUMERIC,
  p_purchase_date DATE,
  p_depreciation_method TEXT,
  p_depreciation_rate NUMERIC,
  p_useful_life_years INTEGER,
  p_salvage_value NUMERIC,
  p_calculation_date DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_months_elapsed INTEGER;
  v_years_elapsed NUMERIC;
  v_depreciable_amount NUMERIC;
  v_annual_depreciation NUMERIC;
  v_accumulated_depreciation NUMERIC;
BEGIN
  -- Return 0 if no purchase price or date
  IF p_purchase_price IS NULL OR p_purchase_date IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate time elapsed
  v_months_elapsed := EXTRACT(YEAR FROM AGE(p_calculation_date, p_purchase_date)) * 12 
                    + EXTRACT(MONTH FROM AGE(p_calculation_date, p_purchase_date));
  v_years_elapsed := v_months_elapsed::NUMERIC / 12;
  
  -- If no time elapsed, no depreciation
  IF v_years_elapsed <= 0 THEN
    RETURN 0;
  END IF;
  
  v_depreciable_amount := p_purchase_price - COALESCE(p_salvage_value, 0);
  
  -- Straight Line Method
  IF p_depreciation_method = 'straight_line' THEN
    IF p_useful_life_years IS NULL OR p_useful_life_years = 0 THEN
      RETURN 0;
    END IF;
    
    v_annual_depreciation := v_depreciable_amount / p_useful_life_years;
    v_accumulated_depreciation := LEAST(v_annual_depreciation * v_years_elapsed, v_depreciable_amount);
    
  -- Declining Balance Method
  ELSIF p_depreciation_method = 'declining_balance' THEN
    IF p_depreciation_rate IS NULL OR p_depreciation_rate = 0 THEN
      RETURN 0;
    END IF;
    
    v_accumulated_depreciation := p_purchase_price * (1 - POWER(1 - (p_depreciation_rate/100), v_years_elapsed));
    v_accumulated_depreciation := LEAST(v_accumulated_depreciation, v_depreciable_amount);
    
  ELSE
    RETURN 0;
  END IF;
  
  RETURN ROUND(v_accumulated_depreciation, 2);
END;
$$;

-- Create trigger function to auto-calculate current value for asset_master
CREATE OR REPLACE FUNCTION update_asset_master_current_value()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.purchase_price IS NOT NULL AND NEW.purchase_date IS NOT NULL AND NEW.depreciation_method IS NOT NULL THEN
    NEW.accumulated_depreciation := calculate_depreciation(
      NEW.purchase_price,
      NEW.purchase_date,
      NEW.depreciation_method,
      NEW.depreciation_rate,
      NEW.useful_life_years,
      NEW.salvage_value
    );
    NEW.current_value := GREATEST(
      NEW.purchase_price - NEW.accumulated_depreciation, 
      COALESCE(NEW.salvage_value, 0)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger function to auto-calculate current value for warehouse_assets
CREATE OR REPLACE FUNCTION update_warehouse_asset_current_value()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.purchase_price IS NOT NULL AND NEW.purchase_date IS NOT NULL AND NEW.depreciation_method IS NOT NULL THEN
    NEW.accumulated_depreciation := calculate_depreciation(
      NEW.purchase_price,
      NEW.purchase_date,
      NEW.depreciation_method,
      NEW.depreciation_rate,
      NEW.useful_life_years,
      NEW.salvage_value
    );
    NEW.current_value := GREATEST(
      NEW.purchase_price - NEW.accumulated_depreciation, 
      COALESCE(NEW.salvage_value, 0)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_asset_master_current_value ON asset_master;
DROP TRIGGER IF EXISTS trigger_update_warehouse_asset_current_value ON warehouse_assets;

-- Create triggers
CREATE TRIGGER trigger_update_asset_master_current_value
BEFORE INSERT OR UPDATE ON asset_master
FOR EACH ROW
EXECUTE FUNCTION update_asset_master_current_value();

CREATE TRIGGER trigger_update_warehouse_asset_current_value
BEFORE INSERT OR UPDATE ON warehouse_assets
FOR EACH ROW
EXECUTE FUNCTION update_warehouse_asset_current_value();