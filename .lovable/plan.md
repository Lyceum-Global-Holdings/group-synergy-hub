## Goal
Make it impossible for the admin console to persist changes to Turnstile surfaces that are enforced by Supabase Auth (`auth`, `portal_login`), and surface a clear, immediate warning if a toggle attempt is made.

## Why
Today the per-surface `Switch` is `disabled` for locked surfaces, but there is no second line of defence. If the disabled state is bypassed (devtools, future refactor, or master switch toggling state), the mutation would still write to `security_settings.turnstile_surfaces`. The toggles are also misleading — users get no feedback explaining why the setting cannot be changed.

## Changes

### 1. `src/pages/admin/SecuritySettings.tsx`
- Extract a `LOCKED_SURFACES` set derived from the `SURFACES` array (`auth`, `portal_login`).
- Add a guarded handler `handleSurfaceToggle(key, value)`:
  - If `key` is in `LOCKED_SURFACES`, call `toast({ variant: "destructive", title: "Locked by Supabase Auth", description: <lockReason> })` and return — no mutation is dispatched.
  - Otherwise, call `apply({ turnstile_surfaces: { ...settings.turnstile_surfaces, [key]: value } })`.
- Wire the per-surface `Switch.onCheckedChange` to `handleSurfaceToggle`.
- In `apply()`, sanitise any incoming `turnstile_surfaces` patch by deleting `auth` and `portal_login` keys before sending to the mutation, so even a programmatic call cannot persist them.
- Keep the existing `disabled` + `Locked` badge + italic `lockReason` UI, and add a small inline warning icon (`Lock` from lucide) next to the badge for stronger visual cue.
- Add a top-level `Alert` (variant `default`, `Info` icon) inside the Bot Protection card explaining: "Internal sign-in and Supplier portal sign-in are managed by Supabase Auth's built-in CAPTCHA. Toggles for these surfaces are read-only here — change them in the Supabase dashboard (Auth → Bot and Abuse Protection)."

### 2. `src/hooks/useSecuritySettings.ts` (defence in depth)
- In `useUpdateSecuritySettings`'s mutation function, before the `update` call, if `payload.turnstile_surfaces` is present, strip the locked keys (`auth`, `portal_login`) from the merged object so they can never be written from anywhere in the app. Add a one-line comment referencing the rule.

### 3. Memory
- Append a one-liner to `.lovable/memory/security/security-settings-console.md` confirming: "Locked surfaces (`auth`, `portal_login`) are blocked client-side in both the page handler and the shared hook; admin UI shows a destructive toast on attempted toggle."

## Out of scope
- No DB migration. The existing column accepts arbitrary JSONB; super_admin RLS still applies. (A DB-level CHECK could be added later, but it would require coordinating with seeded data and is unnecessary given the hook + UI guards.)
- No change to `MfaEnforcementGate`, edge functions, or the master switch.

## Verification
- Open `/admin/security`: `auth` and `portal_login` switches are disabled, show `Locked` badge + lock icon, and the explanatory alert is visible.
- Programmatically calling `apply({ turnstile_surfaces: { auth: false } })` from devtools writes no change (hook strips the key) and the next reload shows the previous value.
- Attempting a toggle (if re-enabled in devtools) fires the destructive toast and dispatches no network request.
