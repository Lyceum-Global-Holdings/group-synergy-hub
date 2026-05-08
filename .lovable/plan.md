# Fix: "captcha protection: request disallowed (no captcha_token found)"

## Why it broke
Supabase Auth has CAPTCHA enforcement enabled at the project level. Once enabled in the Supabase dashboard, **every** `signInWithPassword` / `signUp` call must carry a `captchaToken`, otherwise Supabase rejects with `request disallowed (no captcha_token found)`.

Our `/admin/security` console exposes per-surface toggles including `auth` and `portal_login`. When an admin turns those off, the `<TurnstileWidget>` is hidden, no token is generated, and Supabase blocks the login. The toggle cannot legitimately disable Supabase-enforced CAPTCHA from the client.

This aligns with how Cloudflare/Supabase recommend it (NIST SP 800-63B, OWASP ASVS V11.1.4): bot protection on credential endpoints is enforced by the identity provider itself and must not be a user-tunable control once enabled upstream.

## Fix

### 1. Always render Turnstile on Supabase-auth surfaces
`src/pages/Auth.tsx` and `src/pages/portal/PortalLogin.tsx` will render the widget whenever a `siteKey` is available, regardless of the `useTurnstileEnabledFor('auth' | 'portal_login')` value. The submit button stays disabled until a token is obtained.

### 2. Lock the toggles in the admin console
`src/pages/admin/SecuritySettings.tsx` will:
- Mark the `auth` and `portal_login` switches as read-only (disabled, locked badge).
- Show an inline note: "Enforced by Supabase Auth provider — managed in Supabase dashboard, not here."
- Keep `public_registration` and `portal_invite` fully toggleable (those go through our own edge functions, where `verifyTurnstile()` honors the per-surface flag).

### 3. Edge-function verifier remains unchanged
`supabase/functions/_shared/turnstile.ts` keeps its surface-aware fail-open behavior for the two surfaces that are genuinely app-controlled. Supabase-auth surfaces never reach our verifier, so no edge-function change is required.

### 4. Guard the submit button
Both auth forms will disable the submit button until `captchaToken` is set when the widget is rendered, preventing the request from ever leaving the browser without a token (better UX than a destructive toast).

### 5. Memory update
Update `mem://security/security-settings-console` and `mem://security/turnstile-bot-protection` to record:
- `auth` and `portal_login` Turnstile surfaces are **always-on** (Supabase-enforced); admin console exposes them as read-only.
- Only `public_registration` and `portal_invite` are app-toggleable.

## Files touched
- `src/pages/Auth.tsx` — drop `turnstileEnabled` gate on the widget; require token before submit.
- `src/pages/portal/PortalLogin.tsx` — same.
- `src/pages/admin/SecuritySettings.tsx` — lock the two Supabase-auth surface switches with an explanatory note.
- `.lovable/memory/security/security-settings-console.md` — note locked surfaces.
- `.lovable/memory/security/turnstile-bot-protection.md` — note Supabase-enforced surfaces.

## Out of scope
- Disabling Supabase's project-level CAPTCHA setting (must be done in Supabase dashboard, not from app code).
- MFA enforcement changes — unrelated to this fix.
