

# Fix: Scheduled Telegram Report Not Sending

## Analysis

The scheduled Telegram function ran at 18:00 UTC on Feb 13 (confirmed by `last_scheduled_send = 2026-02-13 18:00:01`), but the report was not delivered. The old logs have expired, so the exact failure point (PDF generation or Telegram API) is unknown. However, there is a **critical bug** that prevents recovery from failures.

## Bug: `last_scheduled_send` Updated Even On Failure

In `supabase/functions/scheduled-telegram-reports/index.ts` at line 323, `last_scheduled_send` is updated after the report processing loop **regardless of whether any sends succeeded**. This means:

1. The function finds reports and tries to send them
2. PDF generation or Telegram API fails for all reports
3. `last_scheduled_send` is still set to today -- marking it as "done"
4. The next cron run sees "already sent today" and skips -- **no retry possible**

## Fix Plan

### 1. Only update `last_scheduled_send` on success (line 323 area)

Move the `last_scheduled_send` update inside a condition that checks if at least one report was sent successfully for that company:

```text
Before:
  // Always runs after loop (even if all sends failed)
  await supabase.from('telegram_settings').update({ last_scheduled_send: ... })

After:
  // Only update if at least one report was actually delivered
  const companyResults = results.filter(r => r.company_id === setting.company_id);
  const anySuccess = companyResults.some(r => r.success && r.report_id);
  if (anySuccess || companyResults.every(r => r.message === 'No reports today')) {
    await supabase.from('telegram_settings').update({ last_scheduled_send: ... })
  }
```

### 2. Add detailed error logging for failure tracking

Add structured logging before the `last_scheduled_send` update so failures are clearly visible:
- Log the count of successful vs failed sends per company
- Log specific failure reasons (PDF generation error, Telegram API error)
- This ensures future failures can be diagnosed even after logs rotate

### 3. Add a manual "Retry" mechanism

In `ViewSiteReportDialog.tsx`, the existing "Send to Telegram" button already works as a manual retry. No changes needed here -- the user can manually resend any report.

## Files to Modify

- `supabase/functions/scheduled-telegram-reports/index.ts` -- Fix the `last_scheduled_send` update logic and improve error logging

## For the Feb 13 Report

Since the Feb 13 report was missed, you can manually send it using the "Send to Telegram" button in the View Site Report dialog. The scheduled function fix will prevent this issue from recurring.

