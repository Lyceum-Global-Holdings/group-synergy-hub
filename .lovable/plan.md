# Restore stock data in Daily Site Reports (today's data)

## Problem
The new `telegram-job-dispatcher` `site_report_daily` renderer only outputs project/weather/manpower/progress. The legacy `scheduled-telegram-reports` function used to also append material issues, stock movements, and current stock balances. Users want these sections back — scoped to **today** (the local day in the job's timezone, up to the moment the report runs), not yesterday.

## Scope
Edit only `renderSiteReportDaily` in `supabase/functions/telegram-job-dispatcher/index.ts`. No DB changes, no UI changes, no changes to the other three report types.

## Changes

### `supabase/functions/telegram-job-dispatcher/index.ts`

1. Add a small helper `currentLocalDay(tz)` (mirrors `previousLocalDay`) that returns `{ from, to, label }` where `from` = local midnight of today, `to` = `now()`, both as ISO timestamps. `label` = today's date in `YYYY-MM-DD` for the job's timezone.

2. Extend `renderSiteReportDaily(sb, job)`:
   - Keep the existing site-report section but switch its window from `previousLocalDay` to `currentLocalDay` so today's submitted DSRs show up.
   - Append three new sections, all scoped to `job.company_id` and today's window:
     a. **Material Issues** — query `material_issue_notes` (+ `material_issue_items` + `warehouse_items`) where `issue_date = today`. Render MIN #, issued_to/department, item code+name, qty.
     b. **Stock Movements** — query `stock_transactions` joined with `warehouse_items_full!inner` (filter `company_id = job.company_id`) where `created_at` ∈ today's window. Show transaction_type, item code+name, qty_before → qty_after (Δ), location, adjusted_by (resolve from `profiles`). Reuse the legacy OR filter so internal sublocation issues are included without duplicating section a.
     c. **Current Stock Balances (as of now)** — query `warehouse_bin_allocations` (no date filter — this is a live snapshot) where `company_id = job.company_id` AND `allocated_quantity > 0`, embed `warehouse_items(item_code,name)` and `warehouse_bins.warehouse_locations(id,name)`. Aggregate by `(item_code, warehouse_id)`; render grouped by warehouse with per-warehouse subtotal and a grand total.

3. Format all sections with `<b>` headers, `esc()` on every interpolated string, `fmtNum()` for numbers, and `<i>No … recorded.</i>` empty states so the section header always renders. Header label should reflect "today" (e.g. `As of {label} HH:MM tz`).

### Caveats
- Per project rule: read item master fields via `warehouse_items_full`, not bare `warehouse_items`, in the stock-movements query.
- No signature change to `renderSiteReportDaily` — the dispatcher's send loop, 4000-char chunking, and run-history logging are unaffected.
- No new secrets or env vars.

## Verification
After deploy, trigger a manual `dry_run` from `/admin/telegram-reports` on a `site_report_daily` job for a company that has today's movements + live stock; confirm the preview shows today's DSR + the three new sections with correct values.
