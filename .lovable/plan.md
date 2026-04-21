

## Codebase Refactoring Plan — Phased, Standards-Based

A pragmatic, low-risk refactor of the Lyceum Global Holdings ERP codebase (~826 TS/TSX files, multiple 1000+ LOC components, 100+ hooks, duplicated import flows). Aligned with **Clean Code**, **SOLID**, **ISO/IEC 25010** (maintainability), **OWASP ASVS** (security), and **React/TypeScript community standards**.

### Guiding principles
- Zero behavior change per phase — refactor, don't rewrite
- Each phase is independently shippable and revertible
- No DB schema changes unless explicitly called out
- Tests / smoke-checks after each phase before moving on

---

### Phase 0 — Baseline & Guardrails *(prerequisite, ~quick)*
Establish safety nets before touching code.

- Add **ESLint + Prettier** strict config (`eslint-plugin-react-hooks`, `@typescript-eslint`, `import/order`)
- Enable `tsconfig` `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`
- Add **Husky + lint-staged** pre-commit hooks
- Add a `CONTRIBUTING.md` with folder conventions and naming rules
- Generate a baseline complexity/duplication report (e.g. `jscpd`) to track progress

**Deliverable:** lint passes, baseline metrics committed.

---

### Phase 1 — Folder & Module Boundaries *(structural)*
Adopt a **feature-sliced architecture** (industry standard for large React apps).

```text
src/
├── app/                  ← App shell, providers, router
├── features/             ← Domain features (warehouse, finance, construction, …)
│   └── warehouse/
│       ├── api/          ← supabase queries + react-query hooks
│       ├── components/   ← feature-only UI
│       ├── hooks/
│       ├── types/
│       ├── utils/
│       └── index.ts      ← public surface
├── shared/               ← Cross-feature reusable code
│   ├── ui/               ← shadcn primitives (current src/components/ui)
│   ├── lib/              ← framework-agnostic helpers
│   ├── api/              ← supabase client, base hooks
│   └── types/
└── pages/                ← Thin route components only
```

- Move existing `src/components/{warehouse,finance,construction,…}` → `src/features/<domain>/components`
- Move matching hooks from flat `src/hooks/` into their feature folder
- Enforce boundaries with `eslint-plugin-boundaries` (no cross-feature imports except via `index.ts`)

**Why:** ISO/IEC 25010 "modularity" + scales for 100+ hooks today.

---

### Phase 2 — Eliminate Duplication & Dead Code
Targeted dedup based on confirmed drift.

- Consolidate `BulkItemImportContent.tsx` (861 LOC) and `BulkItemImportDialog.tsx` (733 LOC) → one shared importer with `mode: 'catalog' | 'inventory'`
- Extract shared CSV parse/validate/preview pipeline to `features/warehouse/lib/bulkImport/`
- Audit for similar parallel flows: GRN dialogs, asset import dialogs, dashboard widgets
- Run `jscpd` / `ts-prune` to remove dead exports
- Centralize repeated patterns (toasts, confirm dialogs, loader fallbacks) into `shared/ui/feedback/`

**Outcome:** single source of truth per workflow; the bulk-import drift bug class disappears permanently.

---

### Phase 3 — Decompose God Components *(SOLID / SRP)*
Break down files >500 LOC. Targets identified:

| File | LOC | Strategy |
|---|---|---|
| `LocationReportAnalytics.tsx` | 1,919 | Split into header / filters / charts / table / export |
| `useMaterialDemand.ts` | 1,493 | Split per concern: queries, calculations, mutations |
| `AssetManagement.tsx` page | 1,347 | Move logic to hooks; page becomes layout + tabs |
| `useConstructionInventory.ts` | 1,283 | Split per entity (serials, bulk, transfers) |
| `MaterialDemandPlanning.tsx` | 1,052 | Container/presentational split |
| `ItemMasterTab.tsx` | 1,045 | Extract toolbar, table, dialogs |
| `CreateSupplierDialog.tsx` | 1,003 | Step components + zod schema per step |

**Rule of thumb:** components ≤ 250 LOC, hooks ≤ 200 LOC, single responsibility.

---

### Phase 4 — Data Layer Standardization
React Query is already used; tighten the contract.

- Standard hook shape: `useXxxQuery`, `useXxxMutation`, colocated `xxxKeys` factory
- Centralize **query key factory** per feature (`features/warehouse/api/queryKeys.ts`) — eliminates the brittle string keys scattered today
- Wrap all Supabase calls in feature-level `api/` modules (no `supabase.from(...)` in components)
- Standard error handler → unified toast + `system_error_logs` capture
- Keep current `staleTime: 0` policy (project memory rule)

**Why:** matches TanStack Query best practices and contains the Supabase coupling.

---

### Phase 5 — Type Safety & Validation Hardening
- Replace all remaining `any` / `as any` with generated types from `src/integrations/supabase/types.ts`
- Adopt **Zod schemas** as the single source for all forms + CSV imports + edge function payloads (OWASP ASVS V5)
- Derive TS types from Zod via `z.infer` — no duplicate definitions
- Form pattern: `react-hook-form` + `zodResolver` everywhere (already a dependency)

---

### Phase 6 — Security & Multi-Tenancy Audit *(OWASP ASVS / project memory rules)*
Codify the patterns already in memory so they can't regress.

- Lint rule / code-mod: every `supabase.from(<tenant_table>).insert(...)` must include `company_id` (matches Core memory rule)
- Audit all RLS-bypassing edge functions for: JWT verification, `can_access_company` check, input zod validation (per `mem://security/edge-function-hardening-standards`)
- Enforce server-side admin checks (per `mem://security/admin-authorization-server-side`)
- Run `security--run_security_scan` after each phase

---

### Phase 7 — Performance & Bundle
- Verify route-level lazy loading (already done in `App.tsx`) — extend to heavy dialogs (PDF/QR utilities, mermaid, three.js)
- Replace `html2canvas` + `jspdf` ad-hoc usage with one shared `shared/lib/pdf/` module
- Audit `react-query` `staleTime: 0` — keep where required, allow opt-in caching for static lookups (categories, units, companies)
- Add **virtualization** (`@tanstack/react-virtual`) to long tables (Item Master, Asset Master, Bins) — aligns with `mem://performance/warehouse-inventory-tab-optimization`
- Bundle analyze with `rollup-plugin-visualizer`

---

### Phase 8 — Design System Consolidation
- Audit `src/components/ui/` (shadcn primitives) — keep as `shared/ui/primitives/`
- Promote repeating composite patterns (DataTable, FilterBar, PageHeader, EmptyState, ConfirmDialog) into `shared/ui/patterns/`
- Tokens-only styling — no hardcoded colors / hex values (per `mem://style/modern-enterprise-design-system`)
- Add a Storybook (optional but recommended) for the design system

---

### Phase 9 — Testing & Documentation
- **Vitest + React Testing Library** for unit tests on hooks and pure utils (start with `itemCodeGenerator`, `stockReconciliation`, FIFO logic)
- **Playwright** smoke tests for critical flows: login, create item (single + bulk), GRN approval, stock transfer
- Generate API docs from Zod schemas
- Update `mem://` rules to reflect new structure

---

### Suggested execution order & effort

| Phase | Risk | Value | Order |
|---|---|---|---|
| 0 Guardrails | Low | High | 1st |
| 6 Security audit | Low | Critical | 2nd (parallel with 0) |
| 2 Dedup | Low | High | 3rd |
| 4 Data layer | Med | High | 4th |
| 1 Folder restructure | Med | High | 5th (after 2 & 4) |
| 3 Decomposition | Med | High | 6th |
| 5 Types/Zod | Low | Med | 7th |
| 7 Performance | Low | Med | 8th |
| 8 Design system | Low | Med | 9th |
| 9 Testing | Low | High | continuous |

---

### What I will NOT change
- Database schema, RLS policies, edge function business logic (unless a security finding requires it)
- Brand identity, design tokens, or current visual UX
- Behavior of any existing workflow

### Approval model
Refactoring 800+ files in one go is reckless. I'll execute **one phase per approval**, with a smoke-test summary after each, and you greenlight the next.

**Recommended starting point:** approve Phase 0 + Phase 2 together — guardrails first, then the bulk-import dedup that's already biting you.

