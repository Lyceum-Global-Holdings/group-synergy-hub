## Advanced Notes Filter Operators (Reports Center)

Add a small operator picker beside the **Notes contain** input on the three warehouse stock reports so users can search with the precision international auditors expect: **contains**, **exact match**, **starts with**, **ends with**, **does not contain**, plus **quoted phrase / multi-term AND** parsing inside the input itself.

All matching stays on the server (Postgres), uses parameterized RPC arguments, and continues to escape SQL `LIKE` wildcards.

### Why this design

- **Familiar to auditors** — matches the operator vocabulary of SAP S/4HANA, Oracle Fusion and Excel AutoFilter, so internal-audit / ISO 9001 reviewers don't need re-training.
- **Server-side only** — operator + term are sent to the RPC. The client never filters rows itself, so paginated and exported results stay consistent with what the database returned (audit-grade).
- **Safe by construction** — the RPC builds a single `ILIKE` pattern from the operator using `replace(...)` to escape `%`, `_`, `\` (we already escape contains; we extend the same escaping to the new operators). The `ESCAPE '\'` clause stays.
- **Quoted phrases & multi-term AND** are parsed server-side for the `contains` operator only, so users can type:
  - `damaged` → single substring
  - `"return to vendor"` → exact phrase, spaces preserved
  - `damaged audit` → must contain BOTH words (any order) — implemented as multiple `ILIKE` clauses joined with `AND`
  - Mixed: `"return to vendor" urgent` → phrase AND word
- **Highlighting still works** — the highlight terms array is built from the parsed tokens so every matched fragment is marked in the preview.

### What changes

**1. New parameter type** in `src/lib/reports/registry.ts`

Replace the current `text`-typed `notesContains` parameter on the 3 reports with a new composite type:

```ts
| {
    key: string;          // e.g. "notesFilter"
    label: string;        // "Notes filter"
    type: "textOperator";
    placeholder?: string;
    /** Field label for the operator dropdown, e.g. "Notes" / "Variance reason" */
    fieldLabel?: string;
    /** Which column key to highlight in the preview */
    highlightColumn: string;
  }
```

The value stored in `values[key]` is `{ op: NotesOp; term: string }` where:
```ts
type NotesOp = "contains" | "equals" | "startsWith" | "endsWith" | "notContains";
```

Default operator: `contains` (preserves current behaviour).

**2. Parameter UI** in `src/components/management/reports/ReportParameterPanel.tsx`

Add a `case "textOperator"` that renders a 2-column row:
- Left: shadcn `Select` with the 5 operators (labels: *contains, equals, starts with, ends with, does not contain*).
- Right: `Input` for the term, placeholder hints at quoted phrases when op = contains (`e.g. damaged "return to vendor"`).

**3. Fetcher hooks** in `src/hooks/reports/useReportData.ts`

Replace the single `notesContains` string with a parsed payload sent to the RPC:

```ts
// New helper
function parseNotesFilter(v: unknown): {
  op: NotesOp;
  terms: string[];   // 1+ tokens for "contains", exactly 1 for the others
} | null
```

`parseNotesFilter` rules:
- `contains`: split on whitespace **outside** double quotes, keep quoted segments as one token, drop empties. Cap at 5 tokens to bound query cost.
- All others: single token = trimmed term (empty ⇒ filter inactive).

Send to the RPC as two new arguments:
- `p_notes_op text` — one of `contains | equals | startsWith | endsWith | notContains`
- `p_notes_terms text[]` — the parsed token array (NULL when filter inactive)

The fetcher passes the parsed terms array into `envelopeBase`'s `highlightTerms`. We extend the envelope to allow `Record<string, string[]>` (array of terms per column) so the preview can mark every token.

**4. Preview highlighter** in `src/components/management/reports/ReportPreviewTable.tsx`

Update `renderHighlighted(text, terms)` to accept an array of terms, build a single combined regex `(t1|t2|t3)` (each token regex-escaped) and wrap matches in `<mark className="rounded-sm bg-warning/30 text-foreground px-0.5">`. Skip highlighting for `notContains` (nothing matched, by definition) and `equals` (whole cell already equals the term — wrap entire cell).

**5. Database (one migration, 3 RPCs)**

Update `report_stock_movement_ledger`, `report_cycle_count_variance`, `report_batch_traceability` to:
- Drop `p_notes_contains` (or keep for backward compatibility as deprecated alias mapped to `op=contains, terms=[value]`).
- Add `p_notes_op text DEFAULT 'contains'` and `p_notes_terms text[] DEFAULT NULL`.
- Build the `WHERE` predicate via:

```sql
WITH op_pat AS (
  SELECT
    p_notes_op AS op,
    ARRAY(
      SELECT replace(replace(replace(btrim(t), '\', '\\'), '%', '\%'), '_', '\_')
      FROM unnest(coalesce(p_notes_terms, ARRAY[]::text[])) AS t
      WHERE btrim(t) <> ''
    ) AS terms
)
-- predicate
AND (
  (SELECT cardinality(terms) FROM op_pat) = 0
  OR CASE (SELECT op FROM op_pat)
    WHEN 'contains'    THEN (SELECT bool_and(notes ILIKE '%' || t || '%' ESCAPE '\') FROM op_pat, unnest(terms) AS t)
    WHEN 'equals'      THEN lower(btrim(notes)) = lower(btrim((SELECT terms[1] FROM op_pat)))
    WHEN 'startsWith'  THEN notes ILIKE          (SELECT terms[1] FROM op_pat) || '%' ESCAPE '\'
    WHEN 'endsWith'    THEN notes ILIKE '%' ||   (SELECT terms[1] FROM op_pat)        ESCAPE '\'
    WHEN 'notContains' THEN notes IS NULL OR NOT (notes ILIKE '%' || (SELECT terms[1] FROM op_pat) || '%' ESCAPE '\')
  END
)
```

Notes:
- `notContains` returns rows where `notes IS NULL` too (matches Excel/SQL Server semantics).
- All operators run inside the existing SECURITY INVOKER RPCs — RLS untouched.
- A whitelist `CHECK (p_notes_op IN ('contains','equals','startsWith','endsWith','notContains'))` at the top of each function rejects unknown operators with a clear error.

### Files touched

- **edit** `src/lib/reports/registry.ts` — new `textOperator` parameter type; switch the 3 stock reports to it
- **edit** `src/components/management/reports/ReportParameterPanel.tsx` — render operator + term row
- **edit** `src/hooks/reports/useReportData.ts` — `parseNotesFilter`, pass `p_notes_op` + `p_notes_terms`, populate `highlightTerms` as string[]
- **edit** `src/lib/reports/types.ts` — `highlightTerms?: Record<string, string[]>`
- **edit** `src/components/management/reports/ReportPreviewTable.tsx` — multi-term `<mark>` rendering, equals/notContains handling
- **migration** update the 3 warehouse RPCs to accept `p_notes_op` + `p_notes_terms` with safe escaping and operator whitelist

### UX

In Reports Center → Warehouse → **Stock Movement Ledger** (or Cycle Count Variance / Batch Traceability):

```text
Notes filter
[ contains ▾ ]  [ damaged "return to vendor"          ]
```

- Pick an operator from the dropdown.
- Type a term — for `contains`, use double-quotes for phrases and spaces to AND multiple words.
- Preview highlights every matched token; exports remain plain text and the operator + term are printed in the report header for audit traceability.

No breaking change for users who don't touch the operator — the default `contains` with a single word behaves exactly like today.
