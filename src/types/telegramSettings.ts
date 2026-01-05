export interface TelegramSettings {
  id: string;
  company_id: string;
  bot_token: string | null;
  chat_id: string | null;
  is_enabled: boolean;
  notify_on_report_create: boolean;
  scheduled_send_enabled: boolean;
  scheduled_send_time: string | null;
  timezone: string | null;
  last_scheduled_send: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateTelegramSettingsData {
  bot_token?: string | null;
  chat_id?: string | null;
  is_enabled?: boolean;
  notify_on_report_create?: boolean;
  scheduled_send_enabled?: boolean;
  scheduled_send_time?: string | null;
  timezone?: string | null;
}
