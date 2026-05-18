# Scheduled Telegram Reports — Administration Console

Centralize all automated Telegram report scheduling under **Administration**, supporting multiple report types with independent daily / weekly / monthly schedules per company. The existing DSR Telegram settings (currently under Construction → Site Reports) will be migrated here so there is one source of truth.

## Goals

1. New admin page **Administration → Telegram Reports** (super_admin / admin only).
2. Support **N scheduled jobs per company**, each with its own report type, frequency, time, timezone, recipients, and on/off toggle.
3. Ship four report renderers out-of-the-box:
   - **Daily Warehouse Stock Report** — per warehouse: movements (in/out/transfer/adjustment counts + qty) for the day + closing stock balance.
   - **Daily Tool Management Report** — per location: tools issued / returned / outstanding / overdue.
   - **Daily Site Report (DSR)** — reuse existing DSR aggregation (manpower, equipment, materials, progress).
   - **Daily Stock Transfer Report** — per location: outgoing & incoming transfers with status.
4. International standards: timezone-aware (IANA tz), idempotent (`last_run_at` + run window), retry-safe, audit-logged, per-company RLS, message size ≤ 4096 chars (chunk or attach PDF for long), structured HTML formatting with localized numbers/dates (ISO 8601 + locale).

## UX

`/admin/telegram-reports` — tabs/sections:

1. **Connection** — bot token, chat IDs, test connection (moved from Construction).
2. **Scheduled Jobs** — table of jobs with columns: Report, Frequency, Time, Timezone, Recipients, Last Run, Status, Actions (Edit / Run Now / Toggle / Delete) + "New Schedule" button.
3. **Run History** — last 100 executions with status, duration, error, recipient count.

Job editor dialog fields: Report Type (select), Frequency (Daily / Weekly + weekday picker / Monthly + day-of-month picker), Send Time + Timezone, Recipient chat IDs (multi), Filters (e.g. specific warehouse / location / company scope), Enabled toggle, "Send test now".

The existing **Construction → Site Reports → Telegram** tab becomes a read-only banner: *"Telegram settings moved to Administration → Telegram Reports"* with a link.

## Architecture

```text
┌──────────────────────────────┐       ┌─────────────────────────────┐
│ /admin/telegram-reports (UI) │──────►│ telegram_scheduled_jobs     │
│  - jobs CRUD                 │       │ telegram_settings (creds)   │
│  - run-now / test            │       │ telegram_job_runs (history) │
└──────────────────────────────┘       └─────────────────────────────┘
            │                                      ▲
            │ invoke                               │ writes
            ▼                                      │
┌──────────────────────────────┐       ┌─────────────────────────────┐
│ edge: send-scheduled-report  │──────►│ report renderers (per type) │
│  (run-now + cron entry)      │       │  - warehouseStockDaily      │
└──────────────────────────────┘       │  - toolManagementDaily      │
            ▲                          │  - siteReportDaily (DSR)    │
            │ every 15 min             │  - stockTransferDaily       │
┌──────────────────────────────┐       └─────────────────────────────┘
│ pg_cron → scheduled-telegram │
│ -reports (dispatcher)        │
└──────────────────────────────┘
```

## Technical Plan

### 1. Database (migration)

- New table `public.telegram_scheduled_jobs`:
  - `id uuid pk`, `company_id uuid fk`, `name text`, `report_type text` (`warehouse_stock_daily` | `tool_management_daily` | `site_report_daily` | `stock_transfer_daily`),
  - `frequency text` (`daily` | `weekly` | `monthly`), `send_time time`, `timezone text`, `weekday smallint NULL` (0–6), `day_of_month smallint NULL` (1–28),
  - `filters jsonb` (`{warehouse_ids?, location_ids?, project_ids?}`),
  - `chat_ids text[]` (overrides company defaults when set),
  - `is_enabled bool`, `last_run_at timestamptz`, `next_run_at timestamptz`, `created_by uuid`, timestamps.
  - Indexes: `(is_enabled, next_run_at)`, `(company_id, report_type)`.
- New table `public.telegram_job_runs` — id, job_id, started_at, finished_at, status (`success`|`partial`|`failed`), recipient_count, error_text, payload_preview. Retention: 100 rows per job (trim trigger).
- RLS: company-scoped via `can_access_company(company_id)`; INSERT/UPDATE/DELETE restricted to admins via `has_role(auth.uid(),'admin')` OR super_admin.
- Deprecate `telegram_settings.scheduled_send_*` columns in a later migration — keep for now for backward compat; new logic ignores them once jobs exist.
- pg_cron entry already exists (`scheduled-telegram-reports` every 15 min) — keep, just point dispatcher at new table.

### 2. Edge functions

- **`scheduled-telegram-reports`** (refactor): query `telegram_scheduled_jobs WHERE is_enabled AND next_run_at <= now()`. For each job: compute window (previous business day in tz), render report, send, write `telegram_job_runs`, recompute `next_run_at` from frequency + `send_time` + `timezone` (use `luxon` via `npm:luxon`). Idempotency: skip if `last_run_at` within ½ frequency window.
- **`send-scheduled-report`** (new): callable from UI for *Run Now* / *Test*. Accepts `{job_id, dry_run?}`. JWT-verified, validates admin role + company scope, calls same renderer pipeline, returns preview when `dry_run`.
- **Renderers** (`supabase/functions/_shared/reports/`):
  - `warehouseStockDaily.ts` — read `stock_transactions` for the day grouped by warehouse + `list_warehouse_inventory` for closing balances (filter from `warehouse_items_full`).
  - `toolManagementDaily.ts` — read `tool_issues`, `tool_returns`, `tool_adjustments` (now unified under warehouse stock per memory) scoped by location.
  - `siteReportDaily.ts` — reuse the DSR aggregation already in `send-telegram-report`.
  - `stockTransferDaily.ts` — read `stock_transfers` per origin/destination location.
  - All return `{title, html, attachments[]}`. HTML uses Telegram-safe subset; chunked at 4000 chars; long reports attached as PDF via existing `lib/reports/pdfRenderer`.

### 3. Frontend

- `src/pages/admin/TelegramReports.tsx` + sub-components: `ConnectionPanel`, `ScheduledJobsTable`, `JobEditorDialog`, `RunHistoryTable`.
- Hooks: `useTelegramJobs`, `useTelegramJobRuns`, `useRunTelegramJobNow`.
- Route: `/admin/telegram-reports`, wrapped in `AdminRoute`.
- Register in `src/constants/moduleConfig.ts` under `administration.submodules`.
- Sidebar entry under Administration.
- Construction Telegram tab → deprecation banner + link.

### 4. Security & Standards

- Server-side admin check in edge function (re-derive from JWT, never trust client).
- Per-company RLS on jobs + runs.
- Bot token stays write-only in `telegram_settings` (never returned to client).
- Audit log entry on job create/update/delete/run.
- ISO 8601 timestamps, `Intl.NumberFormat` for qty/currency, configurable timezone per job (defaults to company tz).
- Rate-limit Telegram sends (≥ 1s between chats) — Telegram API rule.
- Idempotency key per `(job_id, scheduled_for)` to prevent duplicates if cron double-fires.

### 5. Memory

Add memory `features/admin/telegram-scheduled-reports.md` describing job model, dispatcher rules, renderer contract; add Core line: *"Telegram report scheduling lives in `telegram_scheduled_jobs` under Administration; DSR-only `telegram_settings.scheduled_send_*` columns are deprecated."*

## Out of Scope (this phase)

- Telegram inbound commands / bot interactivity.
- WhatsApp / Email parity (can reuse renderer contract later).
- Custom report builder UI — only the 4 built-in types.
- Removing deprecated `telegram_settings.scheduled_send_*` columns (separate cleanup migration after one release).

## Rollout

1. Migration + edge function refactor + renderers.
2. New admin page + sidebar entry + module registration.
3. Backfill: convert any existing `telegram_settings.scheduled_send_enabled=true` row into a `site_report_daily` job.
4. Deprecate old construction tab (banner only, no functional change yet).
