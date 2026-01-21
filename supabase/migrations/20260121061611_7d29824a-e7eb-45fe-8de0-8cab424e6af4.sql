-- Add location_id to daily_site_reports to link reports with warehouse locations
ALTER TABLE public.daily_site_reports 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES warehouse_locations(id) ON DELETE SET NULL;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_daily_site_reports_location_id 
ON public.daily_site_reports(location_id);

-- Create site_report_labour_attendance table for tracking attendance
CREATE TABLE public.site_report_labour_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_report_id UUID NOT NULL REFERENCES daily_site_reports(id) ON DELETE CASCADE,
  labour_id UUID NOT NULL REFERENCES construction_labour_master(id) ON DELETE CASCADE,
  location_id UUID REFERENCES warehouse_locations(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  attendance_date DATE NOT NULL,
  attendance_status TEXT NOT NULL DEFAULT 'present' CHECK (attendance_status IN ('present', 'absent', 'half_day', 'leave')),
  in_time TIME,
  out_time TIME,
  category TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (site_report_id, labour_id, attendance_date)
);

-- Create indexes for efficient querying
CREATE INDEX idx_site_report_labour_attendance_report_id 
ON public.site_report_labour_attendance(site_report_id);

CREATE INDEX idx_site_report_labour_attendance_labour_id 
ON public.site_report_labour_attendance(labour_id);

CREATE INDEX idx_site_report_labour_attendance_date 
ON public.site_report_labour_attendance(attendance_date);

CREATE INDEX idx_site_report_labour_attendance_location 
ON public.site_report_labour_attendance(location_id);

-- Enable Row Level Security
ALTER TABLE public.site_report_labour_attendance ENABLE ROW LEVEL SECURITY;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_labour_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_site_report_labour_attendance_updated_at
BEFORE UPDATE ON public.site_report_labour_attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_labour_attendance_updated_at();

-- RLS Policies for site_report_labour_attendance
CREATE POLICY "Users can view attendance for their company"
ON public.site_report_labour_attendance FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  can_access_company(company_id)
);

CREATE POLICY "Users can create attendance for their company"
ON public.site_report_labour_attendance FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid()) OR
  can_access_company(company_id)
);

CREATE POLICY "Users can update attendance for their company"
ON public.site_report_labour_attendance FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  can_access_company(company_id)
);

CREATE POLICY "Users can delete attendance for their company"
ON public.site_report_labour_attendance FOR DELETE
TO authenticated
USING (
  is_super_admin(auth.uid()) OR
  can_access_company(company_id)
);