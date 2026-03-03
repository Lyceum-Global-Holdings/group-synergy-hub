

# Fix: Scheduled Telegram Report Delivery Reliability

## Problem
The scheduled DSR Telegram delivery at 23:30 IST (18:00 UTC) failed to send on March 2, 2026. The `last_scheduled_send` timestamp confirms it wasn't updated past March 1. The 5-minute matching window is too narrow and offers no retry if the function fails or misses the window.

## Solution: Widen Window + Add Catch-Up Logic

### Changes to `supabase/functions/scheduled-telegram-reports/index.ts`

1. **Increase time matching window from 5 minutes to 15 minutes**
   - Change the `checkTimeMatch` function to allow a 15-minute window instead of 5
   - This gives the cron ~15 chances (once per minute) to successfully trigger the send
   - Reduces the chance of missing the window due to cold starts or transient failures

2. **Add catch-up/retry logic for missed sends**
   - After the normal time-match check, add a secondary check: if `last_scheduled_send` is older than 24 hours AND the current time is past the scheduled time for today, treat it as a missed send and process it
   - This ensures that if the window was missed entirely, the next cron run (within a configurable catch-up period, e.g., up to 2 hours after scheduled time) will still trigger the send
   - Log clearly when a catch-up send is triggered vs. a normal on-time send

3. **Improve logging for debugging**
   - Add a log line at the start of each cron run with the `last_scheduled_send` value so we can trace missed windows in future logs
   - Log the exact reason when a send is skipped (time mismatch, already sent, no reports, etc.)

### Technical Details

**Modified `checkTimeMatch` function:**
- Window changes from `diff >= 0 && diff < 5` to `diff >= 0 && diff < 15`

**New catch-up logic (added after time-match check in the main loop):**
```text
For each company with scheduled sending:
  1. Check normal time match (15-min window) -> process if matched
  2. If NOT matched, check catch-up conditions:
     - last_scheduled_send is NULL or older than 20 hours
     - Current UTC time is between scheduled_utc_time and scheduled_utc_time + 2 hours
     - If both true -> process as catch-up send
```

**Dedup safeguard remains intact:**
- The existing dedup check (skip if `last_scheduled_send >= scheduled_window_start`) prevents double-sends even with the wider window

### Files Modified
- `supabase/functions/scheduled-telegram-reports/index.ts` -- time window + catch-up logic

### Expected Outcome
- Normal sends have 15 chances (15 minutes) instead of 5 to succeed
- If the entire 15-minute window is missed, catch-up logic triggers within the next 2 hours
- No double-sends due to existing dedup protection
- Better logging for future debugging

