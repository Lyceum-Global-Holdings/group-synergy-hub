-- Add report_type column to daily_site_reports
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_period_type') THEN
        CREATE TYPE report_period_type AS ENUM ('daily', 'weekly', 'monthly');
    END IF;
END$$;

ALTER TABLE public.daily_site_reports 
ADD COLUMN IF NOT EXISTS report_type report_period_type NOT NULL DEFAULT 'daily';

ALTER TABLE public.daily_site_reports 
ADD COLUMN IF NOT EXISTS period_start_date date;

ALTER TABLE public.daily_site_reports 
ADD COLUMN IF NOT EXISTS period_end_date date;

-- Add index for filtering by report type
CREATE INDEX IF NOT EXISTS idx_daily_site_reports_report_type 
ON public.daily_site_reports(report_type);

-- Comment for documentation
COMMENT ON COLUMN public.daily_site_reports.report_type IS 'Type of report: daily, weekly, or monthly';
COMMENT ON COLUMN public.daily_site_reports.period_start_date IS 'Start date of the reporting period (for weekly/monthly reports)';
COMMENT ON COLUMN public.daily_site_reports.period_end_date IS 'End date of the reporting period (for weekly/monthly reports)';