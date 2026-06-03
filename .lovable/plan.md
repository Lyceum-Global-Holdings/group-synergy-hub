## Problem
Telegram reports fail with `400 Bad Request: chat not found` for newly added chat IDs (e.g. `-5147769217`). Telegram requires **supergroup/channel** IDs in the `-100<id>` form. Users frequently paste the raw group ID (without the `100` prefix) copied from clients like Telegram Web, which causes "chat not found".

## Fix

Normalize chat IDs both at entry time and at send time, with a one-time auto-retry on send failure.

### 1. `src/components/admin/telegram/JobEditorDialog.tsx` — `addChatId`
- Trim, validate as either `@channelusername` or a numeric chat id.
- Show inline helper text: "For groups/channels paste the full ID including the `-100` prefix (e.g. `-1001234567890`). For private chats use the numeric user ID."
- If the user pastes a negative numeric id whose absolute value has < 13 digits and does not already start with `-100`, surface a warning toast: "This looks like a short group ID — Telegram supergroups need the `-100` prefix. Save anyway?" (still allow save; do not silently mutate).

### 2. `supabase/functions/telegram-job-dispatcher/index.ts` — `sendTelegramMessage` and `sendTelegramDocument`
Wrap the existing fetch in a helper `postToTelegram(method, chatId, buildBody)`:
- Send with the provided `chatId`.
- If response is 400 and body contains `chat not found`, AND `chatId` matches `^-\d+$` and does NOT start with `-100`, retry **once** with `-100` prepended (i.e. `-5147769217` → `-1005147769217`).
- If retry succeeds, log a console warning so admins can clean up the stored value.
- If still failing, throw the original error message (preserve current behavior).

Apply to both `sendMessage` and `sendDocument` paths.

### 3. Out of scope
- No DB migration to rewrite stored chat_ids — keeping the value as-entered + retry-on-send is safer (avoids breaking IDs that were already in `-100…` form or `@username`).
- Other Telegram functions (`send-telegram-report`, `scheduled-telegram-reports`, `test-telegram-connection`) — only the dispatcher was named in the error. Can be extended later if needed.

## Verification
- Re-run the failing job from `/admin/telegram-reports` (Run now) and confirm the document is delivered.
- Check edge function logs for the warning line when the retry path is taken.
