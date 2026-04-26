# Pin Sub-Modules to Top (Per Company)

Add a personal favorites/pinned sub-modules feature so each user can pin the sub-modules they use most often per company, displayed in a dedicated "Pinned" section at the top of the sidebar.

## Why this design (international standards)

- **Per-user, per-company scope** — matches SAP Fiori "My Favorites" and Oracle Cloud "Favorites" patterns where pins are scoped to the user within an organizational/company context. A user working across multiple companies sees a different pin set per company.
- **Sub-module level granularity** — pins target leaf navigation items (the actionable pages), aligned with NN/g and ISO 9241-110 navigation guidance: surface frequently used destinations one click away.
- **Reorderable, capped list** — drag-to-reorder and a soft cap of ~10 pins, in line with Microsoft Fluent and SAP Fiori favorites guidance to prevent visual overload.
- **Server-persisted** — pins follow the user across devices (stored in Supabase with RLS), not localStorage.

## User experience

- A new **"Pinned"** group appears at the top of the sidebar (between the company header and "Navigation"), only when the user has at least one pin for the active company.
- Each sub-module row in the regular module groups gets a small pin icon (visible on hover, filled when pinned). Clicking toggles the pin for the currently selected company.
- When "All Companies" is active, the Pinned section shows the union of pins across the user's accessible companies, each labelled with the company code.
- Pinned items respect existing RBAC: if a user loses access to a sub-module, it is hidden from the Pinned list automatically (record stays in DB so access restoration brings it back).
- A small "Reorder" affordance (drag handle on hover) lets the user reorder pins; order persists.

```text
┌─ Sidebar ──────────────────┐
│  [Company Header]          │
│                            │
│  PINNED                    │
│   ⭐ Purchase Requisition  │
│   ⭐ GRN                   │
│   ⭐ Daily Site Reports    │
│                            │
│  NAVIGATION                │
│   Dashboard                │
│                            │
│  MODULES                   │
│   ▾ Procurement            │
│      Purchase Req.    📌   │ ← hover shows pin
│      Purchase Order   📌   │
│   ▸ Warehouse              │
└────────────────────────────┘
```

## Technical implementation

### 1. Database (migration)

New table `user_pinned_submodules`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid | FK `auth.users(id)` on delete cascade |
| `company_id` | uuid | FK `companies(id)` on delete cascade |
| `module_key` | text | e.g. `procurement` |
| `submodule_key` | text | e.g. `purchase-requisition` |
| `submodule_url` | text | snapshot of route, used for navigation |
| `submodule_title` | text | snapshot of label (fallback) |
| `position` | int | 0-based ordering within (user, company) |
| `created_at` | timestamptz | default `now()` |

- Unique constraint: `(user_id, company_id, module_key, submodule_key)`.
- Index: `(user_id, company_id, position)`.
- RLS: enable; policies — user can `SELECT/INSERT/UPDATE/DELETE` only `WHERE user_id = auth.uid()` AND `public.can_access_company(company_id)` (uses existing helper from the multi-company visibility framework).
- No CHECK on `position`; ordering enforced in app code.

### 2. Hook layer

`src/hooks/useSidebarPins.ts`:
- `usePinnedSubmodules(companyId | "all")` — React Query, returns ordered pins (for "all", merges across `companies` the user can access).
- `useTogglePin()` — mutation: insert if missing (append at next position), delete if present.
- `useReorderPins(companyId)` — mutation: bulk update positions.
- Cache key includes `userId` and `companyId`; invalidated on toggle/reorder.
- Follows existing 30s staleTime convention from the global React Query cache memory.

### 3. Sidebar UI

Edit `src/components/layout/CompanySidebar.tsx`:
- Compute `effectiveCompanyId = isViewingAllCompanies ? "all" : selectedCompany?.id`.
- Fetch pins with `usePinnedSubmodules(effectiveCompanyId)`.
- Cross-reference each pin against the already-computed `departments[]` to confirm the user still has RBAC access; drop orphans from the visible list.
- Render a new `SidebarGroup` titled "Pinned" above "Navigation" when `visiblePins.length > 0`.
  - Each pin: icon from its parent module config + title; in "All Companies" mode, suffix with company code badge.
  - Active state matches existing styling (left border + accent bg).
- For each leaf `SidebarMenuSubButton` in the existing module list, add a trailing pin button (lucide `Pin` / `PinOff`):
  - Visible on row hover (`opacity-0 group-hover/sub:opacity-100`); always visible when pinned.
  - Disabled when `isViewingAllCompanies` (pinning requires a specific company); tooltip explains.
  - `onClick`: stop propagation, call `toggle({ companyId: selectedCompany.id, ... })`.

### 4. Reordering

- Use `@dnd-kit/core` + `@dnd-kit/sortable` (already a common shadcn pattern; add deps if not present) inside the Pinned group only.
- Drag handle visible on hover; on drop, call `useReorderPins`.
- Keep changes optimistic: update React Query cache before server confirms, rollback on error.

### 5. Edge cases & guardrails

- **Cap**: soft limit of 12 pins per (user, company); show a toast "Pin limit reached — unpin something first" when exceeded.
- **All Companies mode**: pin button hidden (only toggle from a specific company context). Reordering disabled in "all" view (pins shown in per-company groups, ordered by company name then `position`).
- **RBAC drift**: orphaned pins (user lost access) are filtered from the UI but kept in DB; an optional cleanup job is out of scope.
- **Collapsed sidebar**: Pinned group renders icon-only (parent module icon) consistent with `collapsible="icon"` behaviour.
- **Super admin "All Companies"**: same union behaviour; no special-case beyond RBAC filter.

## Files

**Create**
- `supabase/migrations/<timestamp>_user_pinned_submodules.sql`
- `src/hooks/useSidebarPins.ts`
- `src/components/layout/SidebarPinButton.tsx` (small reusable trailing pin toggle)
- `src/components/layout/PinnedSubmodulesGroup.tsx` (the new sidebar group + dnd wiring)

**Edit**
- `src/components/layout/CompanySidebar.tsx` — mount `PinnedSubmodulesGroup`, attach `SidebarPinButton` to each leaf row.
- `package.json` — add `@dnd-kit/core` and `@dnd-kit/sortable` if missing.

## Out of scope

- Pinning entire module groups (only sub-modules / leaves).
- Sharing pin sets across users or roles.
- Default pins seeded by admins (can be a follow-up).
