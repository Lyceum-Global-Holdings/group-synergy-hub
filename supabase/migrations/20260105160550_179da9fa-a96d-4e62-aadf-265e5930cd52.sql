-- Add schedule columns to telegram_settings
ALTER TABLE telegram_settings 
ADD COLUMN IF NOT EXISTS scheduled_send_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS scheduled_send_time TIME,
ADD COLUMN IF NOT EXISTS last_scheduled_send TIMESTAMPTZ;