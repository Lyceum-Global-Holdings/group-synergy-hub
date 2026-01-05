-- Add timezone column to telegram_settings table
ALTER TABLE telegram_settings 
ADD COLUMN timezone TEXT DEFAULT 'UTC';