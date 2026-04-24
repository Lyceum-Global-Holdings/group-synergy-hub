---
name: keyset-pagination-uniqueness
description: Keyset cursors must include a strictly unique tuple — never rely on random UUID id alone to tiebreak large equal-created_at buckets
type: preference
---
Keyset (cursor) pagination cursors must form a strictly monotonic, unique tuple over the result order. For tables that have bulk-imported rows sharing a single `created_at`, append a business-unique column (typically `item_code`) before `id`.

**Why:** Random UUID v4 `id` values are not monotonic. If 10k+ rows share one `created_at`, a `(created_at, id)` cursor effectively excludes only ~half the bucket per fetch, causing the iterator to skip rows and terminate early when a page returns `< pageSize`.

**How to apply:**
- Use a tuple like `(created_at DESC, business_unique DESC, id DESC)`. Example: warehouse catalog uses `(created_at, item_code, id)`.
- Back the order with a composite index on the same tuple.
- Cursor predicate must be the standard 3-row form: `c1 < ?  OR (c1 = ? AND c2 < ?)  OR (c1 = ? AND c2 = ? AND c3 < ?)`.
- Implement inside a `SECURITY INVOKER` RPC so the predicate is one server-side expression — not chained PostgREST `.or()` calls.
