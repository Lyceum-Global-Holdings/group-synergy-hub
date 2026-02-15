

# Permanent Fix: Scheduled Telegram Report De-duplication Bug

## Root Cause

The de-duplication check (lines 174-182) prevents the report from being sent by comparing `last_scheduled_send` against **UTC midnight**:

```text
today = midnight UTC (00:00)
if last_scheduled_send >= today → skip
```

Your scheduled time is **23:30 IST = 18:00 UTC**. The database shows `last_scheduled_send = 2026-02-14 04:07 UTC` (09:37 IST) -- set **before** the actual scheduled time. When the real 18:00 UTC run happened, it saw "already sent today" and skipped.

This means any stale or early timestamp after UTC midnight but before 18:00 UTC blocks the entire day's delivery.

## Fix

Replace the UTC-midnight-based check with a check against the **actual scheduled time**. The function should only skip if `last_scheduled_send` is after the most recent occurrence of the scheduled time.

### File: `supabase/functions/scheduled-telegram-reports/index.ts`

#### Change 1: Fix the de-duplication logic (lines 174-183)

Replace the UTC midnight comparison with a comparison against the actual scheduled UTC time:

```text
Before:
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (lastSend >= today) → skip

After:
  // Calculate the scheduled time in UTC for today
  // If that time hasn't passed yet, use yesterday's scheduled time
  // Only skip if last_scheduled_send is AFTER the most recent scheduled window
  const scheduledUtcMinutes = convert scheduled time to UTC minutes
  const scheduledUtcToday = new Date(now) at scheduled UTC hour:minute
  if (scheduledUtcToday > now) subtract 1 day  // hasn't fired yet today
  if (lastSend >= scheduledUtcToday) → skip
```

This ensures the dedup window is anchored to the actual scheduled time, not an arbitrary UTC midnight boundary.

#### Change 2: Add logging for dedup decisions

Log the exact comparison values so future issues are immediately diagnosable:

```text
console.log(`Dedup check: last_scheduled_send=${lastSend}, 
  scheduled window start=${scheduledUtcToday}, 
  skip=${lastSend >= scheduledUtcToday}`)
```

## For the Feb 14 Report

After this fix deploys, you can manually send the Feb 14 report using the "Send to Telegram" button in the View Site Report dialog. The fix ensures future scheduled sends are never blocked by stale timestamps.

## Files to Modify

- `supabase/functions/scheduled-telegram-reports/index.ts` -- Fix dedup check logic (lines 174-183)

