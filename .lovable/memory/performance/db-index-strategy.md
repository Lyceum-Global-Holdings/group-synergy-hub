---
name: db-index-strategy
description: Composite (company_id, created_at DESC) indexes for every multi-tenant list query; partial indexes for pending approval queues
type: preference
---
Every multi-tenant list endpoint that filters by `company_id` and orders by `created_at` DESC must have a composite index `(company_id, created_at DESC)` so the index covers both the RLS filter and ORDER BY in one scan.

Partial indexes are required for "pending"/"active" approval queues where ≥80% of rows are excluded — example: `purchase_requisitions (company_id, created_at DESC) WHERE status IN ('submitted','pending_approval')`.

**How to apply:**
- New hot list table → add composite index in the same migration that creates the table.
- New foreign-key column on a hot table → add a single-column FK index alongside.
- Audit with `supabase--linter` after every schema migration; resolve every "unindexed foreign key" warning before merging.
