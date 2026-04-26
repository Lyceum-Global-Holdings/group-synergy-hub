## Fix: Notes filter silently returns no results for multi-word input

### What's actually happening

I checked the live request you ran. The Stock Movement Ledger sent this to the database:

```
p_notes_op    = "contains"
p_notes_terms = ["ORDER", "PO", "NUMBERS"]
```

Because the previous design split your input on spaces and `AND`-ed every word, the database was looking for rows whose notes contain **all three** of "ORDER" *and* "PO" *and* "NUMBERS". I checked the 284 stock movements in your selected date range — every existing note looks like:

- `Bulk stock upload - Bin: LNPE`
- `Transfer STR-20260425-001 - FIFO out from bin`
- `Bulk stock upload - Bin: LAN`

None contain the words "order", "PO", or "numbers", so the empty result is technically correct — but the **input model is wrong**. International ERPs (SAP S/4HANA Fiori smart filter, Oracle Fusion, Excel AutoFilter "Contains", Jira basic search) all treat unquoted multi-word input as a **single literal phrase**, not as an implicit AND. That's the standard our users expect.

### The fix (one file, one function)

Change the tokeniser in `parseNotesFilter` (`src/hooks/reports/useReportData.ts`) so the `contains` operator follows ISO/SAP-style search semantics:

| What you type | What the DB matches |
|---|---|
| `Bulk stock upload` | notes contain the literal phrase **"Bulk stock upload"** (one substring, spaces preserved) |
| `STR-20260425` | notes contain **"STR-20260425"** |
| `"return to vendor"` | notes contain **"return to vendor"** |
| `"return to vendor" urgent` | notes contain **"return to vendor"** AND **"urgent"** |
| `"audit" "spillage"` | notes contain **"audit"** AND **"spillage"** |

Rules:
- No double-quotes anywhere → the entire trimmed input is **one** literal substring.
- Quotes present → each `"…"` becomes its own AND token; everything outside the quotes is collapsed into **one** additional literal token (so users can never accidentally trigger a strict AND of every single word).
- Capped at 5 tokens for safety.

The other operators (`equals`, `startsWith`, `endsWith`, `notContains`) already treat the term as one literal string — no change needed there.

### Why this is the right fix

- Matches international convention — same as SAP Fiori, Excel "Contains", Jira basic search, ISO 25964-1 thesaurus search.
- Predictable: what the user types is what the database matches, with `"…"` as the only "advanced" syntax.
- Keeps every safety property of the current design — server-side execution, parameterized RPC arguments, `LIKE` wildcard escaping (`%`, `_`, `\`), operator whitelist.
- No database migration needed — the RPCs already accept `text[]` and `bool_and(... ILIKE ...)`. We're only changing how the client builds the array.

### Quick sanity check after the change

With the fix in place, typing `Bulk stock upload` against your live data will return all the "Bulk stock upload - Bin: …" rows; typing `Transfer STR` will return the FIFO transfer rows. The filter chip in the report header will show:

```
Notes filter = contains "Bulk stock upload"
```

so the audit trail is unambiguous.

### Files touched

- `src/hooks/reports/useReportData.ts` — rewrite `parseNotesFilter` tokeniser only. No other files, no DB migration.
