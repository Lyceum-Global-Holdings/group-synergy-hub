## Problem
The user disabled Bot Protection at `/admin/security`, but `/auth` still blocks sign-in because:

1. `Auth.tsx` and `PortalLogin.tsx` render `<TurnstileWidget>` and gate the submit button on `captchaToken` whenever a `siteKey` is present — they ignore the admin toggle entirely.
2. The widget is currently failing with Cloudflare error `110200` (domain not allowed for the configured site key), so no token is ever produced and the button stays disabled forever.
3. Previous decision locked the `auth` / `portal_login` surface toggles in the admin console because Supabase project-level CAPTCHA, when enabled, requires every sign-in to carry a `captchaToken`. That decision is wrong when Supabase's own CAPTCHA setting is OFF — which is the case here.

The admin toggle has to actually take effect for these surfaces, with a clear warning to the operator that Supabase's own CAPTCHA setting (Auth → Bot and Abuse Protection) must also be off, otherwise sign-in will still be rejected by Supabase.

## Changes

### 1. `src/pages/Auth.tsx`
- Render `<TurnstileWidget>` only when `turnstileEnabled !== false && turnstile?.siteKey`.
- Disable the submit button only when `isLoading || (turnstileEnabled !== false && !!turnstile?.siteKey && !captchaToken)`.
- Pass `captchaToken ?? undefined` to `signIn` exactly as today (Supabase will accept it being undefined when project-level CAPTCHA is off).
- Keep the "Protected by Cloudflare Turnstile" footnote conditional on the widget being shown.

### 2. `src/pages/portal/PortalLogin.tsx`
- Same treatment: widget render and submit-disable both gated by `turnstileEnabled !== false`.

### 3. `src/pages/admin/SecuritySettings.tsx`
- Remove the `locked: true` flags on `auth` and `portal_login` so the admin can toggle them.
- Replace the "Locked by Supabase Auth" alert with a `default` warning alert: "Disabling these surfaces only removes the in-app bot challenge. If Supabase's project-level CAPTCHA (Auth → Bot and Abuse Protection in the Supabase dashboard) is still enabled, sign-in will continue to require a token and will fail. Turn that setting off as well to fully disable bot protection on sign-in."
- Drop the `Lock` icon and `Locked` badge for these surfaces.
- Remove the destructive-toast guard (`handleSurfaceToggle` lock branch).

### 4. `src/hooks/useSecuritySettings.ts`
- Remove the `LOCKED_TURNSTILE_SURFACES` re-merge in `useUpdateSecuritySettings` so the admin's intent for `auth` / `portal_login` is actually persisted. Keep the constant export for documentation purposes but stop using it to block writes.

### 5. Memory
- Update `.lovable/memory/security/security-settings-console.md` to flip the rule: "All four surfaces (`auth`, `portal_login`, `portal_invite`, `public_registration`) are admin-toggleable. Disabling `auth` / `portal_login` hides the widget and lifts the in-app token requirement, but the operator must also disable Supabase's project-level CAPTCHA (Supabase dashboard → Auth → Bot and Abuse Protection) for sign-in to succeed."

## Out of scope
- Fixing the underlying Cloudflare `110200` (site-key domain mismatch). That requires the operator to add the current preview/published domain to the Turnstile site-key allowlist in Cloudflare; not an app-code change.
- Programmatic toggle of Supabase's own CAPTCHA setting — there is no API exposed for that.

## Verification
1. Toggle `Internal sign-in (/auth)` OFF in `/admin/security`.
2. Reload `/auth` — Turnstile widget no longer renders; Sign In button is enabled with valid email/password.
3. Sign-in succeeds (assuming Supabase project-level CAPTCHA is also off).
4. Toggle back ON — widget reappears, button gates on token as before.
5. Same flow for `/portal/login`.
