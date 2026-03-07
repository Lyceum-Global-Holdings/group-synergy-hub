

## Root Cause Analysis

The scheduled Telegram reports stopped sending after March 3. Here is the diagnosis from the logs and database:

**Configuration**: Scheduled at 21:30 IST (Asia/Kolkata) = 16:00 UTC. Cron runs every minute. `last_scheduled_send` was stuck at `2026-03-03 18:00:07 UTC` until I force-triggered just now.

**The Bug**: The edge function uses **UTC date** to find reports:
```javascript
const today = new Date();
const todayDateStr = today.toISOString().split('T')[0]; // UTC date
```

At 16:00 UTC on March 6, the UTC date is `2026-03-06` which matches. However, there is a **critical interaction issue**: when the "no reports today" path fires (line 272-281), it **still updates `last_scheduled_send`**, permanently marking the day as "sent" even though nothing was actually delivered. If for any reason the report query returned empty (transient DB issue, brief RLS policy conflict during a migration, etc.), the system silently skips that day forever.

Additionally, the `last_scheduled_send` remained at March 3 for **4 days**, meaning the function never entered the "Processing company" branch during March 4-6 at 16:00 UTC. The catch-up window (2 hours) passed each day and the function just logged "matches: false" the rest of the time.

The most likely scenario: On March 4 at 16:00 UTC, something prevented the time match (possibly a deployment with a brief outage). Once that window passed, the catch-up window (2 hours) also passed. After that, the function needed to wait until the next day's 16:00 UTC, where the same issue repeated.

---

## Plan

### 1. Fix report date to use company's local date (not UTC)

The report lookup should use the **company's timezone** to determine "today's date," not UTC. At 21:30 IST (16:00 UTC), the local date is correct in this case, but this is fragile and breaks for schedules near midnight.

```javascript
// Calculate "today" in the company's local timezone
const offsetHours = TIMEZONE_OFFSETS[setting.timezone || 'UTC'] ?? 0;
const localTime = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);
const todayDateStr = localTime.toISOString().split('T')[0];
```

### 2. Stop updating `last_scheduled_send` when no reports are found

The "no reports today" path should NOT update `last_scheduled_send`. This way, if no reports exist yet at the scheduled time, the system retries on the next cron run within the 15-minute window. Only update `last_scheduled_send` when reports are actually sent or when we've passed the entire 2-hour catch-up window with no reports.

Change the logic to:
- If reports are found and sent: update `last_scheduled_send` (current behavior, keep)
- If no reports found: log a warning but do NOT update `last_scheduled_send`
- Add a separate "end of day" guard: if we're more than 3 hours past the scheduled time and still no reports, then update `last_scheduled_send` to prevent infinite retries

### 3. Widen the catch-up window from 2 hours to 4 hours

This gives more time for recovery after missed windows.

### 4. Add a fallback: look for yesterday's report if today has none

If no report exists for today's local date, also check for yesterday's date as a fallback. This handles cases where reports are created late or the schedule fires after midnight UTC but before midnight local time.

### 5. Redeploy the edge function

The function must be redeployed after the code changes to take effect.

---

### Files to modify

- `supabase/functions/scheduled-telegram-reports/index.ts` — All changes above (date calculation, no-report handling, catch-up window, fallback date logic)

