

# Daily Production Progress Tracking

## Problem

Currently, stage progress is recorded as a single cumulative `input_qty` / `output_qty` / `wastage_qty` on each stage. There's no history of daily entries — users overwrite the totals each time. For real manufacturing, production happens partially each day and users need a daily log to track progress over time.

## Solution: Daily Production Entries Table

Create a `production_daily_entries` table that logs each day's work per stage. The stage's cumulative `input_qty`, `output_qty`, `wastage_qty` become **computed totals** from these daily entries.

## Database Change

New table:

```sql
CREATE TABLE production_daily_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid REFERENCES production_order_stages(id) ON DELETE CASCADE NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  input_qty integer NOT NULL DEFAULT 0,
  output_qty integer NOT NULL DEFAULT 0,
  wastage_qty integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(stage_id, entry_date)
);

ALTER TABLE production_daily_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage daily entries"
  ON production_daily_entries FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

The `UNIQUE(stage_id, entry_date)` constraint ensures one entry per stage per day (upsert-friendly).

## Frontend Changes

### 1. `useProduction.ts`
- Add `useDailyEntries(stageId)` query to fetch entries for a stage
- Add `useAddDailyEntry` mutation that inserts/upserts into `production_daily_entries`, then updates the parent stage's cumulative totals (`input_qty`, `output_qty`, `wastage_qty`) by summing all entries
- Fetch daily entries alongside stage data in `useProductionOrder`

### 2. `StageProgressCard.tsx` — Major Redesign
- Replace the current direct-edit quantity fields with a **daily entry form** (date picker defaulting to today, input/output/wastage fields, notes, "Add Entry" button)
- Show a **daily entries table** below the form listing all past entries (date, in, out, wastage, notes) with running totals
- The stage header still shows cumulative totals (sum of all daily entries)
- Keep existing Start/Complete stage buttons as-is

### 3. New component: `DailyEntryForm.tsx`
- Date picker (defaults to today), input_qty, output_qty, wastage_qty, notes
- If an entry already exists for that date, pre-fill for editing (upsert behavior)
- On save, upsert the daily entry and recalculate stage totals

### 4. New component: `DailyEntriesTable.tsx`
- Compact table showing all daily entries sorted by date descending
- Columns: Date, Input, Output, Wastage, Notes
- Click a row to edit that day's entry
- Footer row showing cumulative totals

## Summary

| Area | Change |
|------|--------|
| Migration | Create `production_daily_entries` table |
| `useProduction.ts` | Add daily entry hooks, update stage totals on entry save |
| `DailyEntryForm.tsx` | New — date-based entry form with upsert |
| `DailyEntriesTable.tsx` | New — historical entries list |
| `StageProgressCard.tsx` | Replace direct qty fields with daily entry UI |
| Supabase types | Regenerate to include new table |

