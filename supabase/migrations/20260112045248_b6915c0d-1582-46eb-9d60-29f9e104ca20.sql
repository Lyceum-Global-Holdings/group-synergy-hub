-- Add expected_return_time column to tool_issues table
ALTER TABLE public.tool_issues 
ADD COLUMN expected_return_time TIME;

-- Add comment for clarity
COMMENT ON COLUMN public.tool_issues.expected_return_time IS 'Expected time of day for tool return';