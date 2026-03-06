

## Diagnosis: Scheduled Telegram Reports Not Sending

### Root Cause Found

**The `bot_token` is being wiped to `NULL` every time the user saves Telegram settings.**

Here's the chain of events:

1. In `TelegramSettingsTab.tsx` line 45, the bot token is **never loaded from the server** (for security): `setBotToken("")`
2. When the user saves **any** setting (e.g., changes the schedule time), line 84-85 runs: `bot_token: botToken || null` -- since `botToken` is always `""`, this sends `null`
3. The upsert in `useTelegramSettings.ts` overwrites the stored bot_token with `null`
4. The scheduled function filters with `.not('bot_token', 'is', null)`, so it finds **zero companies** and skips everything

**Evidence**: The database currently shows `bot_token: NULL`. At 04:12 UTC today, the user saved settings (changed time from 23:30 to 21:30), and immediately after, the function started returning "No companies with scheduled sending enabled."

The `last_scheduled_send` is stuck at March 3rd for the same reason -- any settings save after that date would have cleared the token.

### Fix

**`src/components/construction/TelegramSettingsTab.tsx`** -- Only include `bot_token` in the save payload when the user has actually entered a new token:

```typescript
const handleSave = async () => {
  const data: any = {
    chat_id: chatIds.length > 0 ? chatIds.join(',') : null,
    is_enabled: isEnabled,
    notify_on_report_create: notifyOnCreate,
    scheduled_send_enabled: scheduledSendEnabled,
    scheduled_send_time: scheduledSendEnabled ? `${scheduledSendTime}:00` : null,
    timezone: scheduledSendEnabled ? timezone : null,
  };

  // Only update bot_token if user entered a new one
  if (botToken.trim()) {
    data.bot_token = botToken;
  }

  await saveSettings(data);
};
```

This is a one-file fix. After applying it, the user will need to **re-enter and save their bot token once** to restore it (since it's currently null in the database).

