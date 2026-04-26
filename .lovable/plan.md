## Highlight Matching Notes Text in Report Preview

When a user enters a "Notes contain" search term in the warehouse stock reports, the matched substring will be visually highlighted in the preview table so the reason a row matched is immediately obvious.

### Why this design

- **Match user mental model** — same UX as Gmail / Jira / SAP Fiori "Find" results: the matched text is wrapped in a yellow `<mark>` so the eye lands on it instantly.
- **WCAG 2.2 AA** — using the semantic `<mark>` element with a themed background (mapped to a design-system token, not hard-coded yellow) gives both visual and assistive-tech meaning ("highlighted text").
- **Preview-only, exports untouched** — XLSX/PDF/CSV stay plain text per ISO 9001 §7.5 (documented information must be machine-readable). The filter value is already printed in the report header on every export, which is the audit-grade evidence; on-screen highlighting is purely a navigation aid.
- **Server-driven term** — the highlight term is the exact string that was sent to the RPC, so what the database matched is what the UI highlights (no drift between filter and highlight).

### Changes

**1. Envelope contract** (`src/lib/reports/types.ts`)

Add an optional field:
```ts
highlightTerms?: Record<string, string>; // columnKey -> term to highlight
```

**2. Fetcher hooks** (`src/hooks/reports/useReportData.ts`)

In `fetchStockMovement`, `fetchCycleCountVariance`, and `fetchBatchTraceability`, when a non-empty `notesContains` is provided, attach it to the envelope mapped to the correct column key:

| Report | Column key highlighted |
|---|---|
| Stock Movement Ledger | `notes` |
| Cycle Count Variance | `variance_reason` |
| Batch Traceability | `notes` |

`envelopeBase` will accept an optional `highlightTerms` argument and pass it through.

**3. Preview renderer** (`src/components/management/reports/ReportPreviewTable.tsx`)

For each body cell:
- If the column type is `string` (or untyped) AND `envelope.highlightTerms?.[c.key]` is set AND the cell value contains the term (case-insensitive), render the cell as a sequence of plain-text and `<mark>` segments instead of a single string.
- Otherwise fall back to the current `formatValue(...)` output.

A small helper `renderHighlighted(text, term)`:
```tsx
function renderHighlighted(text: string, term: string) {
  if (!term) return text;
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escape regex
  const re = new RegExp(`(${safe})`, "ig");
  return text.split(re).map((part, i) =>
    re.test(part) && part.toLowerCase() === term.toLowerCase() ? (
      <mark key={i} className="rounded-sm bg-warning/30 text-foreground px-0.5">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
```
The `<mark>` uses the existing `--warning` design-system token (with 30% alpha), so it adapts to light/dark themes and never uses raw hex colours — consistent with the project's design system rules.

Empty cells, non-string columns, and rows where the cell does not contain the term are unchanged.

### Files touched

- `src/lib/reports/types.ts` (edit) — add `highlightTerms` to `ReportEnvelope`
- `src/hooks/reports/useReportData.ts` (edit) — accept/pass `highlightTerms` in `envelopeBase`; populate it in the 3 stock-related fetchers
- `src/components/management/reports/ReportPreviewTable.tsx` (edit) — render `<mark>` segments for highlighted string cells

### UX

In Reports Center → Warehouse → Stock Movement Ledger (or Cycle Count Variance / Batch Traceability):
1. Type `damaged` in **Notes contain** and click Preview.
2. Each row now shows its `Notes` (or `Variance reason`) cell with the substring **damaged** wrapped in a soft warning-tinted highlight.
3. Exports (XLSX, PDF, CSV) remain plain text with the filter value printed in the report header — preserving audit integrity.

No breaking changes; reports without a notes filter render exactly as today.
