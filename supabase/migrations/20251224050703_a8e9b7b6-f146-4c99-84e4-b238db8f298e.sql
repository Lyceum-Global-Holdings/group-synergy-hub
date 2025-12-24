-- Add skilled and unskilled labor count columns to daily_site_reports
ALTER TABLE daily_site_reports
ADD COLUMN IF NOT EXISTS skilled_labor_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS unskilled_labor_count integer DEFAULT 0;

-- Migrate existing labor_count data to unskilled_labor_count (as a reasonable default)
UPDATE daily_site_reports 
SET unskilled_labor_count = COALESCE(labor_count, 0)
WHERE labor_count IS NOT NULL AND unskilled_labor_count = 0;