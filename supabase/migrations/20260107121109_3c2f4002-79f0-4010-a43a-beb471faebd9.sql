-- Assign sudesh.civileng@gmail.com to Lyceum Nugegoda Quarters location
INSERT INTO user_location_assignments (user_id, location_id, company_id, is_primary, created_by)
VALUES (
  'f56f4caa-5aa2-40de-8b02-8cc0c2bf3cf5',  -- sudesh.civileng@gmail.com user_id
  '6508ac11-b2d1-47ea-aa9f-c4fadde44c28',  -- Lyceum Nugegoda Quarters location_id
  '11a46626-34c8-4ea8-8cc1-df0ec439fd48',  -- company_id (same as user's company)
  true,                                     -- is_primary
  NULL                                      -- created_by
);