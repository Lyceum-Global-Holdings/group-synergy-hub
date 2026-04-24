
## Phase 9.5 — Fix "An item with this code already exists in the catalog" on manual item creation

### Symptom
When a user opens **Item / Bin Master → Add Item**, picks a category (e.g. Electrical → ELC), and submits, the form fails with:

> **Error**: An item with this code already exists in the catalog

even though they typed nothing into the Item Code field — the dialog auto-generated `INV-ELE-ELC-0001` (or similar) and the catalog already contains that exact code.

### Root cause (verified against the live database)

`SingleItemForm.tsx` and `CreateItemDialog.tsx` both auto-fill the Item Code via `useNextWarehouseItemCode(categoryCode, companyId)`, which:

```ts
// src/hooks/warehouse/useNextWarehouseItemCode.ts
const prefix = `INV-${categoryCode}-`;
let query = supabase
  .from('warehouse_items')                 // ❌ wrong source of truth
  .select('item_code')
  .ilike('item_code', `${prefix}%`);
if (companyId) query = query.eq('company_id', companyId);   // ❌ scoped to one company
```

But on submit, `SingleItemForm` does a **dual insert** (per `warehouse-catalog-inventory-decoupling` memory):
1. `INSERT INTO warehouse_item_catalog`  ← **GLOBAL**, has `UNIQUE(item_code)` (`warehouse_item_catalog_item_code_key`)
2. `INSERT INTO warehouse_items`         ← per-company, has `UNIQUE(item_code, company_id)`

Live DB confirms the divergence for category `ELC`:
- `warehouse_items` rows for current company with prefix `INV-ELE-ELC-` → **0** (so generator returns `001`)
- `warehouse_item_catalog` rows with prefix `INV-ELE-ELC-` → **86** rows: `001..085` plus a stray `0001`

→ The first insert (catalog) violates `warehouse_item_catalog_item_code_key`, surfaced as the toast in the screenshot.

This is a **systemic correctness bug**, not a one-off. Any company creating its first item in a category that *any other* company has already used will hit it. With 14k+ existing catalog rows across companies, this affects effectively every category.

A secondary inconsistency: catalog has both 3-digit (`085`) and 4-digit (`0001`) padded codes for the same prefix. The current generator does `parseInt`, so it correctly treats them as numeric, but it must scan the global catalog to see them at all.

### Fix — generate codes against the global catalog and stay numeric-monotonic

Update `useNextWarehouseItemCode` so it answers a single question correctly: *"What is the smallest unused integer suffix for `INV-{category}-` across the entire global catalog?"*

#### 1. Switch source table from `warehouse_items` → `warehouse_item_catalog`

```ts
// src/hooks/warehouse/useNextWarehouseItemCode.ts
const prefix = `INV-${categoryCode}-`;

// Catalog is global and owns the UNIQUE(item_code) constraint, so
// it must be the source of truth for the next-suffix calculation.
const { data, error } = await supabase
  .from('warehouse_item_catalog')
  .select('item_code')
  .ilike('item_code', `${prefix}%`);
```

- Drop the `companyId` filter entirely — the catalog has no `company_id`.
- Keep the React Query key dependent on `categoryCode` only (catalog is shared) so cache reuse works across users in the same browser session.

#### 2. Make suffix parsing format-tolerant

The catalog already has mixed widths (`001` vs `0001`). Parse only the trailing digits and ignore non-numeric tails:

```ts
let maxSeq = 0;
for (const row of data ?? []) {
  const tail = row.item_code.slice(prefix.length);     // e.g. "0001", "085-A"
  const m = tail.match(/^(\d+)/);                      // grab leading digits only
  if (!m) continue;
  const seq = Number(m[1]);
  if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
}
const nextSeq = String(maxSeq + 1).padStart(3, '0');   // keep 3-digit default
return `${prefix}${nextSeq}`;
```

This preserves the historical 3-digit padding (so `INV-ELE-ELC-` returns `086`, not `0086`), respecting the documented item-code-generation standard (≤13-char target where the prefix permits) and avoiding a flag-day where every category jumps width.

#### 3. Add a server-side authoritative path (defense in depth)

Even with the fix above, two users in different companies clicking "Add Item" simultaneously can both compute the same `086` and race the catalog UNIQUE. To make collisions self-healing instead of user-visible:

- **New SECURITY INVOKER RPC** `next_catalog_item_code(p_category_code text)` that does the `MAX + 1` lookup inside the database (single round-trip, planner-stable).
- **Client retry on collision**: in `useWarehouseItemCatalog.createMutation`, when the error matches `warehouse_item_catalog_item_code_key` AND the failing `item_code` was the auto-generated one (i.e. user did not edit it manually), call the RPC to fetch a fresh code and retry the insert **once**. If it still fails, surface the existing toast.
  - Track "did the user edit the code?" with a `wasItemCodeEdited` flag set to `true` whenever the Input's `onChange` fires from a real user event (not the auto-fill `useEffect`).

The RPC is the only call that has to be 100% correct; the React-Query hook becomes a UX hint.

```sql
-- Migration outline (no schema change, just an INVOKER helper)
CREATE OR REPLACE FUNCTION public.next_catalog_item_code(p_category_code text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_prefix text := 'INV-' || upper(p_category_code) || '-';
  v_max int;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN substring(item_code FROM length(v_prefix) + 1) ~ '^\d+'
      THEN (regexp_match(substring(item_code FROM length(v_prefix) + 1), '^(\d+)'))[1]::int
      ELSE 0
    END
  ), 0)
  INTO v_max
  FROM public.warehouse_item_catalog
  WHERE item_code ILIKE v_prefix || '%';

  RETURN v_prefix || lpad((v_max + 1)::text, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_catalog_item_code(text) TO authenticated;
```

#### 4. UX touch-ups in `SingleItemForm.tsx` and `CreateItemDialog.tsx`

- Re-fetch the next code (`refetch()`) when the catalog mutation fires `onSuccess` so a second item created in the same dialog session doesn't reuse the just-allocated suffix.
- Update the helper hint under the field from `"Auto-generated: INV-{Category}-Sequence"` to `"Auto-generated from global catalog (last used: INV-{Cat}-{maxSeq})"` so users understand the namespace is shared across companies (per `warehouse-catalog-inventory-decoupling` memory).
- Keep the field read-only by default; allow override via a small "Edit code" toggle (already exists for `editingItem`; extend to manual override on create). Setting the toggle marks `wasItemCodeEdited = true` and disables the auto-retry path described in step 3.

### Why this is the "best" fix (international standards alignment)

- **GS1 GTIN-13 / ISO/IEC 15459** require *globally* unique item identifiers — not company-scoped. Generating codes from a per-company table directly contradicts the standard the project already cites (`item-code-generation-standards` memory). Fix #1 aligns the generator with the namespace its UNIQUE constraint actually enforces.
- **SAP MM "Material Number"** convention is globally unique within a client (mandant). Catalog plays the role of the SAP client here; per-company `warehouse_items` is the plant/storage-location view. Generating from the plant view is the documented anti-pattern.
- **3-digit zero-padding preserved**: most categories are far below 999 items; staying at 3 digits keeps codes within the 13-character GS1 budget for typical 3-letter category mnemonics (`INV-XXX-### = 11 chars`). When a category exceeds 999, the generator naturally rolls to 4 digits via `padStart(3)` (which `String(1000).padStart(3,'0')` returns as `1000`), so no width cap is hit.

### Files to change

1. `src/hooks/warehouse/useNextWarehouseItemCode.ts` — switch source to catalog, drop company filter, format-tolerant parsing, expose `refetch`.
2. `src/components/warehouse/SingleItemForm.tsx` — track `wasItemCodeEdited`, refetch on success, updated helper text, retry-on-collision wrapper.
3. `src/components/warehouse/CreateItemDialog.tsx` — same three changes for parity.
4. `src/hooks/useWarehouseItemCatalog.ts` — `createMutation` accepts an optional `getFreshCode` callback and retries once on `warehouse_item_catalog_item_code_key` if the code was auto-generated.
5. **New migration** — `next_catalog_item_code(text)` RPC.
6. `src/integrations/supabase/types.ts` — auto-regenerated to expose the new RPC.
7. **Memory** — append a note to `.lovable/memory/architecture/tool-promotion-source-of-truth.md` (or create `item-code-namespace-source-of-truth.md`) recording: *"Next-item-code generators MUST query `warehouse_item_catalog` (the table that owns the UNIQUE constraint), never `warehouse_items`."*

### Out of scope / not changed

- No schema migration, no data backfill — the stray `INV-ELE-ELC-0001` row stays as-is; the new generator will skip past it correctly (`maxSeq` = 85, next = 86).
- Bulk import (`BulkItemImportContent.tsx`) already uses `useWarehouseItemCatalog` directly and surfaces "duplicate item codes" — no behavior change needed; users editing CSVs are responsible for their own codes.
- No change to `warehouse_items.item_code` semantics or its `(item_code, company_id)` UNIQUE constraint.

### Verification plan after the fix

1. On the same `/warehouse/item-bin-master` page, pick category Electrical (ELC) → field auto-fills `INV-ELE-ELC-086`. Submit → success.
2. Immediately add a second item in the same dialog session → field shows `INV-ELE-ELC-087` (not `086`).
3. Manually overwrite the field to `INV-ELE-ELC-001` → submit → original error toast appears (correct behavior, manual override).
4. Two browser tabs both opened on category ELC at suffix `088` → first submit succeeds; second submit silently retries via the new RPC and lands on `089`.
