# Cloudflare Turnstile Integration

Add Cloudflare Turnstile (privacy-friendly, GDPR/WCAG-compliant CAPTCHA alternative) to all public, unauthenticated entry points and verify tokens server-side on every protected edge function.

## Why Turnstile
- No personal data collection (GDPR-friendly, no cookies for tracking).
- WCAG 2.1 AA accessible (managed challenge auto-falls back to non-interactive).
- Free, unlimited, with a clean React widget and standard `siteverify` REST API.
- Supports invisible, managed, and non-interactive modes per international UX standards.

## Scope (protected surfaces)

| Surface | File | Mode |
|---|---|---|
| Internal sign-in | `src/pages/Auth.tsx` | managed |
| Supplier portal sign-in | `src/pages/portal/PortalLogin.tsx` | managed |
| Supplier portal invite acceptance | `src/pages/portal/PortalAcceptInvite.tsx` | managed |
| Public supplier registration | wherever `public-supplier-registration` is called from + the edge function | managed |
| MFA challenge | `src/pages/auth/MfaChallenge.tsx` | invisible (only after N failed attempts — managed flag) |

All surfaces fail closed: if Turnstile is configured but the token is missing/invalid, the request is rejected with HTTP 400.

## Secrets

Two new secrets, requested via the secrets tool after user confirmation:
- `TURNSTILE_SITE_KEY` — public, safe to expose. Stored as a runtime secret and surfaced to the client through a tiny helper edge function `turnstile-config` (so the key isn't hardcoded and can be rotated without a redeploy).
- `TURNSTILE_SECRET_KEY` — server-only, used by edge functions to call `https://challenges.cloudflare.com/turnstile/v0/siteverify`.

A development fallback (`1x00000000000000000000AA` site key + `1x0000000000000000000000000000000AA` secret — Cloudflare's official always-passes test pair) is used when secrets are not set, so the app keeps working in preview.

## Frontend implementation

1. New component `src/components/security/TurnstileWidget.tsx`:
   - Lazy-loads `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` once.
   - Renders the widget into a div, exposes `onVerify(token)`, `onExpire`, `onError`.
   - Auto-detects theme (light/dark) from `document.documentElement.class`.
   - Sets `data-language="auto"` for i18n; respects `prefers-reduced-motion`.
   - Calls `turnstile.reset(widgetId)` on submit failure.

2. New hook `src/hooks/useTurnstileSiteKey.ts`: fetches the site key once from `turnstile-config` edge function, caches in React Query (`staleTime: Infinity`).

3. Wire the widget into the five forms above. Submit buttons stay disabled until a token is present. The token is included in the request payload (`turnstile_token`) for edge functions, or as `options.captchaToken` for `supabase.auth.signInWithPassword` / `signUp` / `verifyOtp` (Supabase has built-in Turnstile support — no extra plumbing needed for auth calls once the project's Auth → Bot Protection is enabled).

## Backend implementation

1. New shared verifier inlined per function (no shared dir per project conventions): `verifyTurnstile(token, ip)` → POSTs to `siteverify` with `secret`, `response`, `remoteip`. Returns `{ success, error_codes, hostname, action }`. Rejects if `success !== true` or if `hostname` is not in an allowlist (`stores.lgh.lk`, `*.lovable.app`, `localhost`).

2. Edge functions updated:
   - `public-supplier-registration` — verify before rate-limit check.
   - `supplier-invite` — verify on the public-accept path.
   - `supplier-accept-invite` — verify before token consumption.
   - New `turnstile-config` — returns `{ siteKey }` (public, no JWT).

3. Supabase Auth: instruct the user (in chat) to enable Turnstile under Auth → Settings → Bot and Abuse Protection, pasting the same `TURNSTILE_SECRET_KEY`. Once enabled, Supabase enforces the captcha on `signInWithPassword`, `signUp`, `resetPasswordForEmail`, and `verifyOtp` automatically.

## International / compliance standards

- **GDPR / ePrivacy**: Turnstile sets no tracking cookies; a one-line notice is added to the auth pages: "Protected by Cloudflare Turnstile — no personal data is collected."
- **WCAG 2.1 AA**: managed mode passes most users without interaction; `aria-label` on the widget container; keyboard-focusable fallback.
- **OWASP ASVS V11.1**: bot-resistance control on all unauthenticated endpoints.
- **NIST SP 800-63B**: rate-limiting + bot challenge on authentication endpoints (combined with existing per-IP rate limit in `public-supplier-registration`).
- **PCI-DSS 6.4.2** (only relevant if payments added later): documented anti-automation control.

## Memory updates

Add `mem://security/turnstile-bot-protection` documenting:
- All public/auth surfaces must include `<TurnstileWidget />` and submit `turnstile_token`.
- All public edge functions must call `verifyTurnstile()` and fail closed.
- Allowed hostnames list lives in the verifier; update it whenever a new domain is published.
- Add to `mem://index.md` Core: "Public/auth forms gated by Cloudflare Turnstile; edge functions must verify server-side."

## Out of scope
- Replacing existing in-app rate limiters (Turnstile augments, not replaces them).
- Adding Turnstile to authenticated-only mutations (not needed; JWT + RLS already gate those).
- Custom captcha analytics dashboard.

## Confirmation needed
1. Do you have a Cloudflare account with Turnstile site + secret keys ready to add to Lovable secrets, or should I start with Cloudflare's always-pass test keys and you'll swap them in later?
2. Allowed hostnames — confirm the list: `stores.lgh.lk`, `*.lovable.app`, `localhost`. Anything else (custom staging domain)?
3. Should the internal `/auth` sign-in also require Turnstile, or limit to public/portal surfaces only? (Recommend: yes, internal too — it's the highest-value target.)
