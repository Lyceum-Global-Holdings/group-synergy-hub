-- Fix: Update all warehouse_tools with NULL company_id at Lyceum Nugegoda Quarters location
-- This ensures indumalk@gmail.com can see tools (their company filter will now match)
UPDATE warehouse_tools 
SET company_id = '11a46626-34c8-4ea8-8cc1-df0ec439fd48'
WHERE location_id = '6508ac11-b2d1-47ea-aa9f-c4fadde44c28'
  AND company_id IS NULL;