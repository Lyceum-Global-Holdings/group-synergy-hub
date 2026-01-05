-- Create telegram_settings table for per-company Telegram configuration
CREATE TABLE telegram_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  bot_token TEXT,
  chat_id TEXT,
  is_enabled BOOLEAN DEFAULT false,
  notify_on_report_create BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE telegram_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view telegram_settings"
  ON telegram_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert telegram_settings"
  ON telegram_settings FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update telegram_settings"
  ON telegram_settings FOR UPDATE TO authenticated
  USING (true);

-- Create updated_at trigger
CREATE TRIGGER update_telegram_settings_updated_at
  BEFORE UPDATE ON telegram_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();