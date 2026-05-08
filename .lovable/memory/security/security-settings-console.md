---
name: security-settings-console
description: Central admin console at /admin/security controls Turnstile and MFA enforcement; backed by security_settings table with audit log
type: feature
---

Super-admin only page at `/admin/security` (registered in `moduleConfig.ts` under `administration`).

Backed by `public.security_settings` (singleton id='global'):
- `turnstile_enabled` (master) + `turnstile_surfaces` jsonb { auth, portal_login, portal_invite, public_registration }
- `mfa_policy` enum: disabled | optional | required_admins | required_all
- `mfa_grace_period_days` (0–90), `mfa_remember_device_hours` (0–720)
- `allowed_mfa_factors` text[] (TOTP only for now)

Access: SELECT for any authenticated user (gates need it). INSERT/UPDATE only via `is_super_admin()`. Audit trigger writes every change to `security_audit_log` (super-admin SELECT only).

Frontend wiring:
- Pre-auth pages call `security-settings-public` edge function (verify_jwt=false) via `useTurnstileEnabledFor(surface)`. Widget is hidden + `captchaToken` not required when surface disabled.
- Edge functions call `verifyTurnstile(token, ip, action, surface)`; if surface disabled, verifier short-circuits success without checking the token. Fails OPEN only on the configured surface flag — never on missing config.
- `MfaEnforcementGate` (mounted in `ProtectedLayout` inside `AppLayout`): if user is in scope of policy and has no verified TOTP factor, shows banner during grace period and hard-redirects to `/auth/mfa-setup` after.

CRITICAL — Supabase-Auth surfaces (`auth`, `portal_login`) are LOCKED ON in the admin console. Once Supabase project-level CAPTCHA is enabled, every `signInWithPassword` / `signUp` call MUST carry a `captchaToken` or Supabase rejects with `request disallowed (no captcha_token found)`. The toggle cannot legitimately disable that from the client. `Auth.tsx` and `PortalLogin.tsx` therefore render `<TurnstileWidget />` whenever `siteKey` is present, ignoring the per-surface flag, and disable the submit button until a token is obtained. Only `portal_invite` and `public_registration` surfaces (which go through our own edge functions) are admin-toggleable. Defence in depth: `useUpdateSecuritySettings` re-fetches the locked-surface values and forces them back into any patch before write, and `SecuritySettings.tsx` shows a destructive toast on any attempted toggle of locked surfaces. The `LOCKED_TURNSTILE_SURFACES` constant exported from `useSecuritySettings.ts` is the single source of truth.

Standards: NIST SP 800-63B AAL2, ISO 27001 A.9.4.2, OWASP ASVS V2/V11, SOC 2 CC6.1/CC7.2, GDPR Art. 32.

Reminder: Supabase dashboard's own CAPTCHA toggle (Auth → Settings) is independent; surfaced in the UI.
