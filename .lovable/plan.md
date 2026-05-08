# Security Settings Admin Console

Add a single Administration page that lets super-admins toggle Cloudflare Turnstile and configure MFA enforcement, aligned with NIST SP 800-63B (AAL2), ISO 27001 A.9.4, and SOC 2 CC6.

## What the user gets

New route: `/admin/security` (Administration → Security Settings), super-admin only.

**Bot Protection (Cloudflare Turnstile)** — per-surface toggles:
- Internal sign-in (`/auth`)
- Portal sign-in (`/portal/login`)
- Portal invite acceptance
- Public supplier registration
- Master kill switch

Each toggle shows current site-key health (from `turnstile-config`) and last verification stats.

**Multi-Factor Authentication** — policy selector:
- `disabled` — MFA hidden
- `optional` — users may self-enroll (current behavior)
- `required_admins` — admin / super_admin / moderator must enroll (NIST AAL2 for privileged users)
- `required_all` — every user must enroll

Plus: grace period (days) before unenrolled users are blocked, allowed factor types (TOTP always; WebAuthn reserved for later), and a "remember device" window (hours, default 0 per AAL2).

## How it works

```text
security_settings (singleton, id = 'global')
  ├─ turnstile_enabled            bool
  ├─ turnstile_surfaces           jsonb { auth, portal_login, portal_invite, public_registration }
  ├─ mfa_policy                   enum  disabled|optional|required_admins|required_all
  ├─ mfa_grace_period_days        int   default 7
  ├─ mfa_remember_device_hours    int   default 0
  ├─ updated_by, updated_at
```

- RLS: SELECT for any authenticated user (needed by gates), UPDATE/INSERT only via `is_super_admin()`.
- Trigger writes every change to `security_audit_log` (who/when/before/after) — SOC 2 evidence.
- `useSecuritySettings()` hook with React Query (`staleTime: 60s`).
- Edge function `security-settings-public` returns the subset needed pre-auth (Turnstile flags) so the login pages can decide whether to render `<TurnstileWidget />`.

### Turnstile gating
- `TurnstileWidget` and `verifyTurnstile()` become conditional: if the relevant surface flag is `false`, the widget is not rendered and the edge function skips verification (fail-open by config, never by missing token).
- Master kill switch overrides per-surface flags.

### MFA enforcement
- New gate component `MfaEnforcementGate` mounted inside `AppLayout` (after `AuthContext` resolves):
  1. Fetch settings + `supabase.auth.mfa.listFactors()` + current user role.
  2. Decide if user is in scope (`required_admins` vs `required_all`).
  3. If in scope and no verified factor:
     - Within grace period → show dismissible banner with CTA to `/auth/mfa-setup`.
     - After grace period → hard redirect to `/auth/mfa-setup` and block app routes (allow only `/auth/*` and logout).
- AAL2 step-up: when `mfa_policy != disabled` and a verified factor exists, require an MFA challenge once per `mfa_remember_device_hours` for sensitive routes (admin/*, finance/*). Implemented via a `useRequireAal2()` hook that calls `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` and routes to `/auth/mfa-challenge` when `currentLevel !== 'aal2'`.
- Existing `MfaSetup.tsx` and `MfaChallenge.tsx` are reused unchanged.

### Admin UI (`/admin/security`)
- Two cards: "Bot Protection" and "Multi-Factor Authentication".
- Each toggle is optimistic with a confirm dialog for destructive changes (e.g. turning Turnstile off, raising policy to `required_all`).
- "Audit log" tab below pulls last 50 rows from `security_audit_log`.
- Help copy cites the standard each control maps to (NIST AAL2, ISO 27001 A.9.4.2, OWASP ASVS V2).

## Files to add / change

**New**
- `supabase/migrations/<ts>_security_settings.sql` — table, enum, RLS, audit trigger, seed singleton row.
- `supabase/functions/security-settings-public/index.ts` — unauthenticated read of Turnstile flags.
- `src/hooks/useSecuritySettings.ts` — authenticated full settings.
- `src/hooks/usePublicSecuritySettings.ts` — pre-auth Turnstile flags.
- `src/hooks/useRequireAal2.ts` — step-up gate for sensitive routes.
- `src/components/auth/MfaEnforcementGate.tsx`
- `src/pages/admin/SecuritySettings.tsx`

**Edited**
- `src/App.tsx` — register `/admin/security` route under `SuperAdminRoute`; mount `MfaEnforcementGate` inside `AppLayout`.
- `src/constants/moduleConfig.ts` — add `security-settings` submodule under `administration`.
- `src/components/security/TurnstileWidget.tsx` — accept `surface` prop and no-op when disabled.
- `src/pages/Auth.tsx`, `src/pages/portal/PortalLogin.tsx`, `src/pages/portal/PortalAcceptInvite.tsx`, `src/pages/PublicSupplierRegistration.tsx` — pass `surface` to widget; allow submit when surface disabled.
- `supabase/functions/_shared/turnstile.ts` — read flags via service-role client; skip verification when surface disabled (still log).
- `supabase/functions/public-supplier-registration/index.ts`, `supplier-accept-invite/index.ts` — pass `surface` to verifier.
- `supabase/config.toml` — register `security-settings-public` (verify_jwt = false).
- `mem://security/turnstile-bot-protection` — note that gating is now driven by `security_settings`.
- New memory `mem://security/mfa-enforcement-policy` — record policy semantics.

## Standards mapping
- NIST SP 800-63B AAL2 → `required_admins` minimum, optional remember-device window.
- ISO 27001 A.9.4.2 → centrally managed authentication strength.
- SOC 2 CC6.1 / CC7.2 → audit log of every toggle.
- OWASP ASVS V2.8 (MFA) and V11 (bot defenses) → per-surface CAPTCHA control.
- GDPR Art. 32 → administrative control surface for security measures.

## Out of scope (callouts)
- WebAuthn/passkey enrollment (TOTP only for now; schema leaves room).
- Per-company overrides (single global policy this round; table is keyed so we can add later).
- Supabase dashboard's own Turnstile setting still has to be toggled manually if you want the master kill switch to also disable Supabase-side captcha — surfaced in the UI as a reminder.
