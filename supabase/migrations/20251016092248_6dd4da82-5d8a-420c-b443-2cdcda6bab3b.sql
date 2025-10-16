-- Update training_manuals table for link-based documents
ALTER TABLE training_manuals
  ADD COLUMN document_url TEXT,
  ADD COLUMN thumbnail_url TEXT;

-- Rename file_path to legacy_file_path
ALTER TABLE training_manuals
  RENAME COLUMN file_path TO legacy_file_path;

-- Make legacy columns nullable
ALTER TABLE training_manuals
  ALTER COLUMN legacy_file_path DROP NOT NULL;

ALTER TABLE training_manuals
  ALTER COLUMN file_url DROP NOT NULL;

-- Add constraint to ensure either document_url or legacy_file_path exists
ALTER TABLE training_manuals
  ADD CONSTRAINT check_document_source 
  CHECK (document_url IS NOT NULL OR legacy_file_path IS NOT NULL);