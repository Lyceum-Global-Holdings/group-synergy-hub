## Goal
When a Telegram stock report job has specific warehouse locations selected, list those location names in the Telegram message caption instead of the generic `Locations: 1 (filtered)`.

## Change
File: `supabase/functions/telegram-job-dispatcher/index.ts` — `renderWarehouseStockDaily` (around lines 240–247).

Replace the single `Locations:` line with:

- If `locationIds.length > 0` (filtered): render `Locations (filtered): <Name A>, <Name B>, …` using names from the already-fetched `locMap`. Fall back to the location id (or "Unknown") if a name is missing. Truncate to ~6 names with `+N more` to keep the caption within Telegram's 1024-char limit.
- If no filter: keep `Locations: <count> (all)`.

Sort names alphabetically for stable output. Reuse existing `esc()` helper for HTML safety.

## Out of scope
- PDF body already groups per location; no change needed there.
- Other report types (tool/site/transfer) — user only mentioned warehouse stock report.
- UI changes in `/admin/telegram-reports` — selection already works.
