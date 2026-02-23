

# Fix: send-telegram-report Edge Function — Backwards Compatibility

## Problem

The `send-telegram-report` edge function is rejecting requests because they contain `bot_token` and `chat_id` directly in the body (old format) instead of `company_id` (new format). This happens when the published/cached version of the app sends the old format. The function returns a **400 error**, which surfaces as the "Failed to send — Edge Function returned a non-2xx status code" toast.

## Root Cause

The edge function was updated to require `company_id` and fetch Telegram credentials server-side (for security), but the published app still sends `bot_token` and `chat_id` directly. The function rejects these requests at line 85-91 because `company_id` is undefined.

## Solution

Make the edge function handle **both** request formats:

1. **New format** (has `company_id`): fetch credentials from `telegram_settings` table as it does today
2. **Old/fallback format** (has `bot_token` and `chat_id` directly): use those credentials directly after verifying the user is authenticated

This is a single-file change to `supabase/functions/send-telegram-report/index.ts`.

## File to Change

| File | Change |
|---|---|
| `supabase/functions/send-telegram-report/index.ts` | Add fallback logic for requests that include `bot_token`/`chat_id` directly |

## Technical Detail

After parsing the request body (line 65), instead of immediately rejecting when `company_id` is missing, the function will check if `bot_token` and `chat_id` are provided directly. If so, it skips the company membership check and the database credentials lookup, and proceeds directly to sending the Telegram message using the provided credentials.

```typescript
// After parsing requestBody...

let telegramBotToken: string;
let chatIds: string[];

if (company_id) {
  // NEW FORMAT: verify membership, fetch credentials from DB
  // ... existing logic (lines 96-154)
  telegramBotToken = settings.bot_token;
  chatIds = settings.chat_id.split(',').map(id => id.trim()).filter(Boolean);
} else if (requestBody.bot_token && requestBody.chat_id) {
  // OLD FORMAT fallback: use provided credentials directly
  // (user is already authenticated via JWT above)
  console.log("Using legacy format with direct bot_token/chat_id");
  telegramBotToken = requestBody.bot_token;
  chatIds = requestBody.chat_id.split(',').map(id => id.trim()).filter(Boolean);
} else {
  // Neither format — reject
  return new Response(
    JSON.stringify({ error: 'Company ID or bot_token/chat_id are required' }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

The rest of the function (PDF decoding, Telegram API call) remains unchanged since it already uses `telegramBotToken` and `chatIds` variables.

This ensures both the current preview build (which sends `company_id`) and the published build (which sends `bot_token`/`chat_id`) work correctly.
