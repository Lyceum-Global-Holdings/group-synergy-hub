# Contributing Guide — Lyceum Global Holdings ERP

This document codifies the conventions every contributor (human or AI) must follow. It is the source of truth for folder layout, naming, security, and refactor standards.

It complements — and never overrides — the rules captured in `mem://` memory files.

---

## 1. Guiding Principles

- **Clean Code** — small, single-responsibility units; readable names; no dead code.
- **SOLID** — especially Single Responsibility (no god components/hooks).
- **ISO/IEC 25010** — modularity, reusability, testability, security.
- **OWASP ASVS** — server-side validation, RLS-first, never trust the client.
- **Zero behavior change per refactor PR** — refactor and rewrite are different things.

---

## 2. Folder Conventions

The codebase is gradually migrating to a **feature-sliced architecture**. New code MUST follow the target layout below; existing code is migrated phase by phase.

```
src/
├── app/                  ← App shell, providers, router (future)
├── features/             ← Domain features
│   └── <domain>/
│       ├── api/          ← supabase queries + react-query hooks
│       ├── components/   ← feature-only UI
│       ├── hooks/
│       ├── lib/          ← framework-agnostic feature helpers
│       ├── types/
│       └── index.ts      ← public surface (only export what other features need)
├── shared/               ← Cross-feature reusable code
│   ├── ui/               ← composite patterns (DataTable, FilterBar, …)
│   ├── lib/              ← framework-agnostic helpers (pdf, csv, …)
│   └── api/              ← supabase client, base hooks
├── components/ui/        ← shadcn primitives — DO NOT modify carelessly
├── pages/                ← Thin route components only
└── lib/                  ← Legacy helpers being migrated to shared/lib
```

### Rules
- No cross-feature imports except via the feature's `index.ts`.
- `pages/*` files contain layout + routing only — business logic lives in hooks.
- `components/ui/` (shadcn) is the design-token primitive layer. Promote repeating composite patterns to `shared/ui/`.

---

## 3. Naming Conventions

| Kind | Pattern | Example |
|---|---|---|
| React component file | `PascalCase.tsx` | `ItemMasterTab.tsx` |
| Hook file | `useCamelCase.ts` | `useWarehouseItems.ts` |
| Pure util file | `camelCase.ts` | `itemCodeGenerator.ts` |
| Type file | `camelCase.ts` | `itemBin.ts` |
| Test file | `*.test.ts(x)` colocated | `itemCodeGenerator.test.ts` |
| Query key factory | `<entity>Keys` | `warehouseItemKeys` |
| React Query hook | `use<Entity><Action>` | `useWarehouseItemsQuery`, `useCreateItemMutation` |
| Edge function dir | `kebab-case` | `po-email-approval` |
| DB table | `snake_case` | `warehouse_items` |

---

## 4. Size Budgets (SRP)

Refactor when a file crosses these limits. Soft limit, but PRs adding new code above the hard limit must split.

| Type | Soft | Hard |
|---|---|---|
| React component | 250 LOC | 500 LOC |
| Hook | 200 LOC | 400 LOC |
| Util module | 300 LOC | 600 LOC |
| Edge function `index.ts` | 300 LOC | 500 LOC |

Decompose by responsibility, not by line count alone:
- Components → header / filters / table / dialogs / hooks
- Hooks → queries / mutations / derived state / side effects

---

## 5. Data Layer Standards

- **All Supabase calls** belong in `features/<domain>/api/` modules — not in components.
- Every React Query call uses a typed key from a colocated `queryKeys` factory.
- Standard hook shape:
  - `useXxxQuery(params)` — read
  - `useXxxMutation()` — write
- `staleTime: 0` and `refetchOnMount: 'always'` remain the global default (per `mem://architecture/react-query-global-cache-freshness-permanent`). Opt-in caching is allowed only for static lookups (categories, units, companies) and must be justified in the PR.
- All errors must funnel through the unified handler so they show a toast AND get logged to `system_error_logs` where appropriate.

---

## 6. Type Safety & Validation

- No `any` / `as any`. Use generated types from `src/integrations/supabase/types.ts`.
- All forms use **react-hook-form + zodResolver**.
- All CSV imports and edge-function payloads are parsed through a Zod schema.
- Derive TS types via `z.infer<typeof schema>` — never duplicate.

---

## 7. Security & Multi-Tenancy (non-negotiable)

These rules are also stored in `mem://security/*`. Violations are blockers.

- **Every** insert into a tenant-scoped table MUST include `company_id` (per Core memory rule).
- RLS on tenant tables uses `can_access_company(company_id)` — never `USING(true)`.
- Roles are stored in `user_roles`. Never read roles from `profiles` or client storage.
- Admin checks happen **server-side** (per `mem://security/admin-authorization-server-side`).
- Edge functions that bypass RLS MUST: verify JWT, validate input with Zod, and check `can_access_company` (per `mem://security/edge-function-hardening-standards`).
- Storage uploads: `owner = auth.uid()` on insert; only owner or admin can update/delete.
- Run `security--run_security_scan` after any RLS, edge-function, or storage policy change.

---

## 8. Design System

- Use semantic Tailwind tokens defined in `src/index.css` and `tailwind.config.ts`.
- **Never** hardcode colors (no `text-white`, `bg-black`, `#hex`) in components.
- All colors are HSL.
- Promote repeating composite patterns to `shared/ui/` rather than duplicating.

---

## 9. Item Code Standards

Auto-generated item codes follow `INV-{CAT}-{NNN}` where `{CAT}` is the 3-letter ISO 7372 / SAP MM mnemonic on the category (per `mem://architecture/item-code-generation-standards` and `mem://architecture/warehouse-category-code-mnemonic-standard`).

- Single-item creation: `useNextWarehouseItemCode`
- Bulk import: `allocateItemCodes({ scope, count, ... })` from `@/utils/itemCodeGenerator`
- Both flows must go through these utilities — never construct codes manually.

---

## 10. Bulk Import Pipeline

All CSV bulk imports for warehouse items MUST use the shared pipeline:

- `src/lib/bulkImport/csvParser.ts` — RFC-4180-tolerant parser
- `src/lib/bulkImport/lookups.ts` — name→id resolvers (categories, units, suppliers, …)
- `src/lib/bulkImport/autoCodeAllocator.ts` — groups rows and calls `allocateItemCodes`

Mode-specific behavior (`catalog` vs `inventory`) is the only thing that may differ between flows.

---

## 11. Refactor Workflow

1. State the phase you're executing (Phase 0–9 of the roadmap).
2. Open the smallest possible PR — one phase, one concern.
3. No behavior change. Smoke-test the affected flows before declaring done.
4. Update memory (`mem://`) when conventions evolve.

---

## 12. Forbidden

- Adding `USING(true)` RLS policies on tenant tables
- Reading or writing user roles from anything other than `user_roles`
- Storing roles or admin flags in `localStorage` / `sessionStorage`
- Hardcoded colors in components
- New `any` / `as any`
- New Supabase calls inside components (must live in `features/<domain>/api/`)
- New duplicate import flows (always extend the shared pipeline)
