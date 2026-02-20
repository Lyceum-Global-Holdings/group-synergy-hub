
# Scheduled Stock Audit Log — Desync Trend Tracking

## What This Does

Every time the Stock Audit tab is opened (and the audit data finishes loading), a snapshot is automatically written to a new `warehouse_stock_audit_logs` table in the database. This creates a timestamped history of desync counts and the list of affected items, so warehouse managers can see whether desyncs are growing or shrinking over time.

The Stock Audit tab gains a second section — a "Audit History" panel — that reads past log entries and shows a trend table and a line chart.

---

## Database Changes

### New Table: `warehouse_stock_audit_logs`

```sql
CREATE TABLE public.warehouse_stock_audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  recorded_by   uuid NOT NULL,          -- auth.uid() at time of audit view
  recorded_at   timestamptz NOT NULL DEFAULT now(),
  total_items   integer NOT NULL,
  in_sync_count integer NOT NULL,
  desync_count  integer NOT NULL,
  no_bins_count integer NOT NULL,
  -- JSON array of desynced items snapshot
  desynced_items jsonb NOT NULL DEFAULT '[]',
  -- JSON array of no-bins items snapshot
  no_bins_items  jsonb NOT NULL DEFAULT '[]'
);
```

**RLS policies** (matching the `warehouse_items` lockdown pattern):
- `SELECT`: Authenticated users who are members of the same `company_id`
- `INSERT`: Authenticated users only (the app writes automatically on tab open)
- `DELETE`: Admins only
- `ALTER TABLE ... FORCE ROW LEVEL SECURITY` applied

**Index** on `(company_id, recorded_at DESC)` for efficient trend queries.

---

## Code Changes

### 1. `src/hooks/useStockAudit.ts`

Add a `useMutation` called `logAuditSnapshot`:

```typescript
const logSnapshotMutation = useMutation({
  mutationFn: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !selectedCompany?.id) return;

    const desynced = auditItems.filter(i => i.status === 'desync');
    const noBins   = auditItems.filter(i => i.status === 'no_bins');

    await supabase.from('warehouse_stock_audit_logs').insert({
      company_id:    selectedCompany.id,
      recorded_by:   user.id,
      total_items:   summary.total,
      in_sync_count: summary.inSync,
      desync_count:  summary.desynced,
      no_bins_count: summary.noBins,
      desynced_items: desynced.map(i => ({
        id: i.id, item_code: i.item_code, name: i.name,
        current_stock: i.current_stock, bin_total: i.bin_total, variance: i.variance
      })),
      no_bins_items: noBins.map(i => ({
        id: i.id, item_code: i.item_code, name: i.name,
        current_stock: i.current_stock
      })),
    });
  },
});
```

Also add a `useQuery` to fetch audit history:

```typescript
const { data: auditHistory = [] } = useQuery({
  queryKey: ['stock-audit-history', selectedCompany?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from('warehouse_stock_audit_logs')
      .select('id, recorded_at, recorded_by, total_items, in_sync_count, desync_count, no_bins_count, desynced_items, no_bins_items')
      .eq('company_id', selectedCompany!.id)
      .order('recorded_at', { ascending: false })
      .limit(50);
    return data || [];
  },
  enabled: !!selectedCompany?.id,
});
```

Expose `logSnapshot`, `auditHistory` from the hook.

---

### 2. `src/components/warehouse/StockAuditTab.tsx`

**Auto-log on tab mount** (when data is ready):

```typescript
const hasLogged = useRef(false);

useEffect(() => {
  if (!isLoading && auditItems.length > 0 && !hasLogged.current) {
    hasLogged.current = true;
    logSnapshot();
  }
}, [isLoading, auditItems]);
```

The `useRef` guard ensures one insert per tab open, not on every re-render.

**New "Audit History" section** below the existing table:

A collapsible card titled "Audit History (Last 50 Opens)" containing:

- **Trend Table**: columns `Date/Time | Total Items | In Sync | Desynced | No Bins | Desynced Items`
  - Desynced count cell is highlighted red when > 0, green when 0
  - "Desynced Items" column shows a popover/tooltip listing affected item codes
- **Trend indicator**: Each row shows an arrow (↑ ↓ →) compared to the previous log entry's `desync_count` — immediately surfaces whether desyncs are growing or shrinking

**Visual design:**

```
┌─ Audit History (Last 50 Opens) ────────────────────────────────────┐
│ Date/Time          Total   In Sync   Desynced   No Bins   Items    │
│ 2026-02-20 09:41   702     699       3 ↑        0         SizeLable│
│                                                           WaistbandW│
│                                                           8zipperG  │
│ 2026-02-19 14:22   701     701       0 ↓        0         —         │
└────────────────────────────────────────────────────────────────────┘
```

---

## Files to Create / Edit

| File | Action | Description |
|---|---|---|
| `supabase/migrations/<timestamp>.sql` | Create | New `warehouse_stock_audit_logs` table with RLS |
| `src/hooks/useStockAudit.ts` | Edit | Add `logSnapshot` mutation + `auditHistory` query |
| `src/components/warehouse/StockAuditTab.tsx` | Edit | Auto-log on mount + Audit History panel |

---

## Important Behaviours

- **Debounce / dedup**: The `useRef` guard ensures only one snapshot is written per tab open, even if the component re-renders.
- **No snapshot if empty**: The insert is skipped if `auditItems.length === 0` (e.g. company has no items yet) to avoid polluting the log with empty entries.
- **Multi-company safe**: `company_id` is always recorded, so audit history is scoped correctly per company.
- **No PII in log**: The snapshot stores item codes/names and stock numbers only — no user-identifying data beyond `recorded_by` (the auth UID).
- **History is read-only in UI**: Users can view history but cannot edit it. Admins can delete entries via SQL if needed (RLS permits admin DELETE).
- **Supabase default 1000-row limit**: The query uses `.limit(50)` so the last 50 audit opens are shown — well within limits.
