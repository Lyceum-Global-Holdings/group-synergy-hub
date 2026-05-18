---
name: Telegram Scheduled Reports
description: Multi-job Telegram report scheduler under Administration; jobs table + dispatcher edge function + 5-min cron
type: feature
---
# Telegram Scheduled Reports (Administration)

**Page:** `/admin/telegram-reports` (AdminRoute) — registered in `moduleConfig.administration.submodules`.

## Tables
- `telegram_scheduled_jobs` — one row per schedule (company_id, name, report_type, frequency, send_time, timezone, weekday, day_of_month, chat_ids[], filters, is_enabled, last_run_at, next_run_at).
  - CHECK ensures weekly jobs have `weekday`, monthly jobs have `day_of_month`.
  - BEFORE INSERT/UPDATE trigger `telegram_job_set_next_run` recomputes `next_run_at` via `compute_telegram_job_next_run()`.
- `telegram_job_runs` — execution history (status: running/success/partial/failed, recipient_count, error_text, payload_preview, triggered_by).
- RLS: company-scoped SELECT via `can_access_company`; ALL mutations require admin or super_admin role.

## Edge function
- **`telegram-job-dispatcher`** (`verify_jwt = false`):
  - Empty body = cron dispatch → finds `is_enabled AND next_run_at <= now()`, runs each job.
  - `{ job_id, dry_run? }` body = manual / preview from admin UI; requires Bearer JWT + `is_admin` RPC check.
  - Resolves bot token + default chat IDs from `telegram_settings` (per company); job-level `chat_ids` override.
  - Telegram messages are chunked at 4000 chars; 1.1s sleep between sends (rate-limit).
  - Renderers (4): warehouse_stock_daily, tool_management_daily, site_report_daily, stock_transfer_daily — query the previous local day in the job's timezone.

## Cron
- `cron.job` entry `telegram-job-dispatcher-every-5min` → POSTs to function every 5 minutes with empty body + anon apikey header.
- Legacy `check-scheduled-telegram-reports` cron + `scheduled-telegram-reports` function remain (untouched) for backward compat; deprecate after one release.

## Report types
| key | Source tables |
|-----|---------------|
| warehouse_stock_daily | stock_transactions grouped by location + warehouse_items closing balance snapshot |
| tool_management_daily | tool_issues, tool_returns + overdue (status != returned AND expected_return_date < today) |
| site_report_daily | daily_site_reports (yesterday) |
| stock_transfer_daily | stock_transactions WHERE reference_type='transfer' (transfer_out events) |

## Backfill
Migration auto-creates a `site_report_daily` job for every company that had `telegram_settings.scheduled_send_enabled = true`.

## Gotchas
- Bot token never leaves the server — `telegram_settings.bot_token` is read only by the dispatcher with the service-role key.
- Manual `dry_run` returns the rendered HTML preview without sending; logged with status=success and triggered_by=test.
- `last_run_at` is only updated for cron + manual runs (NOT test/dry_run), so `next_run_at` stays anchored to the schedule.
