# Phase 1 Implementation Plan — PEPPOL UBL 2.1 E-Invoicing & Supplier Portal Foundations

Scope assumptions (filled in based on best-fit defaults; tell me if any should change):
- **AP provider**: Storecove (REST-first, EU + APAC + LATAM coverage, built-in PEPPOL BIS Billing 3.0 + Schematron validation, sandbox available).
- **Country scope (Day 1)**: PEPPOL BIS Billing 3.0 (EN 16931 baseline). Country-specific extensions deferred to Phase 4: SA ZATCA, IN IRP, IT SDI, MX CFDI.
- **Supplier auth**: Supabase Auth (email + password) with mandatory TOTP MFA for `owner` role. SSO (Microsoft/Google) optional in Phase 4.
- **Delivery**: Phase 1 only in this iteration — foundations (schema, RLS, supplier role, portal shell, profile, invitations). Phase 2 (sourcing flows), Phase 3 (PEPPOL pipeline), Phase 4 (hardening + country mandates) follow as separate iterations.

---

## Phase 1 Deliverables

A working **Supplier Portal shell** at `/portal/*` where invited suppliers can:
1. Accept an invitation and create their account
2. Log in with MFA
3. View a portal dashboard (placeholder KPIs)
4. Manage their company profile (legal name, tax IDs, PEPPOL participant ID, bank details, certifications)
5. Manage additional users on their supplier account (owner / contributor / viewer)

Plus internal admin screens to **invite suppliers** to the portal and view supplier-portal activity.

E-invoicing UBL/PEPPOL pipeline and RFQ/quote flows are NOT in Phase 1 — only the foundations and tables they will plug into.

---

## 1. Database Migration (single migration)

### 1.1 Enum extension
- Add `supplier` to existing `app_role` enum.

### 1.2 New tables (all RLS-enabled, company-scoped where applicable)

**`supplier_users`** — links auth users to a supplier
- `id uuid pk`
- `supplier_id uuid → suppliers(id) on delete cascade`
- `user_id uuid → auth.users(id) on delete cascade`
- `portal_role text check in ('owner','contributor','viewer')`
- `is_active boolean default true`
- `invited_by uuid`, `invited_at`, `accepted_at`
- `created_at`, `updated_at`
- Unique `(supplier_id, user_id)`
- Index `(user_id)`, `(supplier_id, is_active)`

**`supplier_invitations`**
- `id uuid pk`
- `supplier_id uuid → suppliers(id) on delete cascade`
- `email citext not null`
- `portal_role text check (...)`
- `token_hash text not null` (we store SHA-256 of the raw token; raw token only emailed)
- `expires_at timestamptz not null` (default `now() + interval '7 days'`)
- `accepted_at timestamptz`
- `revoked_at timestamptz`
- `invited_by uuid`
- `company_id uuid → companies(id)` (the inviting tenant)
- Unique `(supplier_id, email)` partial where `accepted_at is null and revoked_at is null`
- Index `(token_hash)`, `(email)`

**`peppol_participants`** (for both our companies and suppliers — populated now, used in Phase 3)
- `id uuid pk`
- `owner_type text check in ('company','supplier')`
- `owner_id uuid not null`
- `scheme_id text not null` (ISO 6523, e.g. `0088`, `0184`, `0151`, `0192`)
- `participant_id text not null`
- `is_primary boolean default true`
- `verified_at timestamptz`
- `created_at`
- Unique `(owner_type, owner_id, scheme_id, participant_id)`
- Check `participant_id ~ '^[A-Za-z0-9:_.-]+$'`

**`supplier_profiles_extended`** (portal-only fields kept off the main `suppliers` table to avoid churn)
- `supplier_id uuid pk → suppliers(id) on delete cascade`
- `legal_name text`
- `tax_id_encrypted bytea` (pgsodium column-encrypt later in Phase 4 — Phase 1 stores `tax_id text` plain; column renamed in Phase 4)
- `bank_account_name text`
- `bank_account_number text` (Phase 4 → encrypted)
- `bank_iban text`
- `bank_swift text`
- `default_currency char(3)` (ISO 4217)
- `default_payment_terms_days int`
- `peppol_enabled boolean default false`
- `updated_at`, `updated_by`

**`supplier_portal_audit`** (append-only)
- `id bigserial pk`
- `supplier_id uuid`
- `actor_user_id uuid`
- `action text` (login, profile_update, user_added, user_removed, invitation_accepted, ...)
- `metadata jsonb`
- `ip inet`
- `user_agent text`
- `prev_hash text`
- `row_hash text` (sha256 over canonical row → tamper-evident chain; trigger computes)
- `created_at timestamptz default now()`

### 1.3 Storage
- New private bucket `supplier-documents` (path `{supplier_id}/{yyyy}/{filename}`) for certifications uploaded via portal.

### 1.4 RLS policies (key ones)

`supplier_users`
- Internal admins: `has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin')` — full access.
- Supplier owners: can SELECT/INSERT/UPDATE rows for their own `supplier_id` (only `portal_role` other than `owner` for INSERT to prevent privilege escalation).
- Other supplier roles: SELECT-only on rows in their `supplier_id`.

`supplier_invitations`
- Internal admins/managers: full.
- No supplier-side access (token-based redemption goes through edge function).

`supplier_profiles_extended`
- Supplier members (any portal_role): SELECT.
- Supplier `owner`: UPDATE.
- Internal admins: SELECT/UPDATE.

`supplier_portal_audit`
- Supplier members: SELECT only their own supplier's rows.
- Internal admins: SELECT all.
- INSERT only via SECURITY DEFINER function `log_supplier_portal_event(...)` — no direct INSERT.

`peppol_participants`
- Supplier members: SELECT/INSERT/UPDATE their own.
- Internal admins: full.

`storage.objects` (bucket `supplier-documents`)
- Read/Write only when `(storage.foldername(name))[1] = supplier_id::text` AND user is in `supplier_users` for that supplier.

### 1.5 Helper functions
- `public.is_supplier_member(_supplier_id uuid)` SECURITY DEFINER STABLE — boolean, used in RLS to avoid recursion.
- `public.current_supplier_ids()` SECURITY DEFINER STABLE — returns set of supplier_ids the caller belongs to.
- `public.log_supplier_portal_event(_supplier_id, _action, _metadata)` SECURITY DEFINER — inserts into audit with hash chain.
- Trigger on `supplier_portal_audit` BEFORE INSERT → sets `prev_hash` and `row_hash`.

### 1.6 Indexes
- `supplier_users(user_id)`, `supplier_users(supplier_id, is_active)`
- `supplier_invitations(token_hash)`, `(email)`, `(supplier_id) where accepted_at is null and revoked_at is null`
- `supplier_portal_audit(supplier_id, created_at desc)`

---

## 2. Edge Functions

### 2.1 `supplier-invite` (admin → invites a supplier user)
- Auth: requires logged-in user with `admin` or `manager` role; verify via JWT.
- Input (Zod): `{ supplier_id: uuid, email: string, portal_role: 'owner'|'contributor'|'viewer' }`
- Validates supplier belongs to caller's accessible companies.
- Generates raw token (32 bytes URL-safe), stores SHA-256 hash + expires_at.
- Sends invitation email via Resend (reuses pattern from `send-approval-notification`); link `https://<app>/portal/accept-invite?token=<raw>`.
- Logs `invited` audit row.
- Rate limit: 20 invites / hour / inviter (in-memory map keyed by user_id; documented as best-effort).

Required secret check: `RESEND_API_KEY` (already exists per project pattern; if missing, ask user).

### 2.2 `supplier-accept-invite` (public — token in body)
- No JWT required (public endpoint). CORS open.
- Input (Zod): `{ token: string, password: string (min 12, complexity), full_name: string }`
- Looks up invitation by SHA-256(token); validates not expired/revoked.
- Creates auth user via `supabase.auth.admin.createUser({ email_confirm: true })` (service role, server-side only).
- Inserts `supplier_users` row with `portal_role` from invitation.
- Marks invitation `accepted_at = now()`.
- Logs `invitation_accepted` audit.
- Returns `{ success: true }` — client then signs in via standard Supabase auth.

### 2.3 `supplier-portal-mfa-enroll` (Phase 1 stub — returns enrollment URI; reuses existing MFA flow from `MfaSetup.tsx`)
- Optional in Phase 1 — we can reuse the existing internal MFA flow by routing supplier users through `/portal/mfa-setup`. No new edge function needed if so. Keep this as a TODO marker.

---

## 3. Frontend (React)

### 3.1 New routes (in `src/App.tsx`)
- `/portal/accept-invite` — public, redeems token
- `/portal/login` — themed login
- `/portal/mfa-challenge`, `/portal/mfa-setup` — wrappers around existing MFA pages with portal layout
- `/portal` (guarded) → redirects to `/portal/dashboard`
- `/portal/dashboard`
- `/portal/profile`
- `/portal/users`
- `/portal/peppol-ids`

### 3.2 New components
- `src/components/portal/PortalLayout.tsx` — header w/ Lyceum branding, supplier name, user menu, logout. No internal sidebar.
- `src/components/portal/SupplierRoute.tsx` — guard analogous to `AdminRoute.tsx`:
  - Checks session
  - Checks `has_role(uid,'supplier')`
  - Loads `supplier_users` row → exposes `currentSupplierId` via context
  - Enforces MFA enrollment before any portal page
- `src/contexts/SupplierContext.tsx` — provides `{ supplierId, portalRole, supplierName }`
- `src/hooks/useSupplierProfile.ts`
- `src/hooks/useSupplierUsers.ts`
- `src/hooks/useSupplierInvitations.ts`

### 3.3 Pages
- `src/pages/portal/AcceptInvite.tsx` — form: full name + password; calls `supplier-accept-invite` edge fn; on success redirects to `/portal/login`.
- `src/pages/portal/PortalLogin.tsx` — supplier-themed login, then redirects to `/portal/dashboard`.
- `src/pages/portal/PortalDashboard.tsx` — placeholder cards: "Open RFQs (Phase 2)", "Active POs (Phase 2)", "Outstanding Invoices (Phase 3)", "Profile completeness %".
- `src/pages/portal/SupplierProfile.tsx` — form for `supplier_profiles_extended` fields; uses Zod validation; empty strings → null per project rule.
- `src/pages/portal/SupplierUsers.tsx` — list `supplier_users`, invite new (calls `supplier-invite`), revoke. Owner-only mutations.
- `src/pages/portal/PeppolIds.tsx` — manage `peppol_participants` rows with scheme picker (ISO 6523 dropdown of common schemes).

### 3.4 Internal admin additions
- `src/pages/sourcing/SupplierPortalAdmin.tsx` — new screen under Sourcing module: list suppliers w/ portal status, invite users, view portal audit, deactivate users.
- Add link from existing supplier detail dialog: "Invite to Portal" button.

### 3.5 Module registration (`src/constants/moduleConfig.ts`)
- Register `supplier-portal-admin` (internal admin) under Sourcing.
- Portal routes are NOT in moduleConfig (separate auth realm). They are guarded only by `SupplierRoute`.

### 3.6 RBAC (`src/constants/rbacConfig.ts`)
- Add `supplier` to `APP_ROLE_HIERARCHY` (level 0 — below `user`; isolated tree).
- Add `DEFAULT_OPERATIONS_BY_ROLE.supplier = ['view']`.

### 3.7 Auth redirect logic
- After login in `Auth.tsx`: if user's only role is `supplier`, redirect to `/portal/dashboard` instead of `/`.
- After login on `/portal/login`: if user is NOT supplier, sign them out and show error "Use the main login at /auth".

---

## 4. Validation & Security

- Zod schemas for every form and every edge function input.
- Edge functions use service role internally only; never returned.
- Tokens: 32-byte random, URL-safe; only hash stored; one-time use (set `accepted_at` on success).
- Password policy enforced server-side in `supplier-accept-invite`: min 12 chars, mixed case + digit + symbol.
- MFA mandatory for portal `owner` role — `SupplierRoute` blocks routes other than `/portal/mfa-setup` until enrolled.
- All portal mutations log to `supplier_portal_audit` via the SECURITY DEFINER function.
- CORS: edge functions return `Access-Control-Allow-Origin: *` for the public accept-invite endpoint only; others honor request origin.
- Rate-limit notes documented; full Redis-backed rate limiting deferred to Phase 4.

---

## 5. Memory Updates

After build, add to `mem://`:
- `mem://architecture/supplier-portal-architecture` — separate `/portal/*` realm, `SupplierRoute` guard, `SupplierContext`.
- `mem://security/supplier-portal-rls` — RLS via `is_supplier_member()` helper; never query `supplier_users` directly in policies (recursion).
- `mem://access-control/supplier-role` — `supplier` is an isolated app_role; redirect target `/portal/dashboard`.
- `mem://features/supplier-portal/invitations` — token hashed, 7-day expiry, single-use.
- Update Core: add line "Supplier portal users are isolated to `/portal/*`; never grant them internal module access."

---

## 6. Out of Scope for Phase 1 (explicitly)

- UBL builder, PEPPOL AP integration, Storecove credentials, webhooks
- RFQ visibility / quote submission / PO acknowledgement
- Inbound/outbound invoice tables and 3-way match wiring
- Column-level encryption (pgsodium) — fields stored plain; migration in Phase 4 will encrypt in place
- Country-specific extensions (ZATCA / IN IRP / SDI / CFDI)
- DSAR export endpoint

---

## 7. Acceptance Criteria

1. Admin can invite a supplier user from `Sourcing → Supplier Portal Admin`. Email arrives with link.
2. Recipient opens link, sets full name + password, gets account; redirected to `/portal/login`.
3. After first login, forced through MFA enrollment; subsequent logins prompt MFA challenge.
4. Supplier sees only their own supplier in profile/users/peppol pages — verified by attempting URL/ID tampering (RLS blocks).
5. Owner can add a contributor user; contributor cannot add or remove users (enforced by both UI and RLS).
6. All portal actions appear in `supplier_portal_audit`, hash-chained.
7. Internal users with non-`supplier` roles cannot access `/portal/*`. Supplier-role users cannot access internal routes.
8. Supabase linter shows no new RLS warnings on the new tables.

---

## 8. Open confirmations before I start coding

If you disagree with any of the filled-in defaults below, reply now; otherwise I proceed:

1. **AP provider = Storecove** (Phase 3 only — no credentials needed for Phase 1).
2. **Day-1 country scope = PEPPOL BIS Billing 3.0** (EN 16931). Country mandates in Phase 4.
3. **Supplier auth = Supabase Auth + mandatory TOTP MFA for owners**. SSO later.
4. **Phase 1 only this iteration**, then we proceed sequentially through Phases 2 → 3 → 4.

Reply "go" (or with any overrides) and I will switch to build mode and execute Phase 1: migration first (for your approval), then edge functions and frontend in one pass.
