---
name: Cloudflare Turnstile bot protection
description: All public/auth surfaces gated by Turnstile widget; edge functions verify server-side
type: feature
---
All public-facing and authentication-adjacent forms must include `<TurnstileWidget />` (from `src/components/security/TurnstileWidget.tsx`) and submit either `turnstile_token` in the request body (custom edge functions) or `options.captchaToken` (supabase.auth.* methods).

**Frontend wiring:**
- Use `useTurnstileSiteKey()` hook to get the site key (cached forever).
- Submit button stays disabled until `captchaToken` is set; reset token on error.
- Always include the disclosure: "Protected by Cloudflare Turnstile — no personal data is collected."

**Backend wiring:**
- Edge functions import `verifyTurnstile, getRequestIp` from `../_shared/turnstile.ts`.
- Call `verifyTurnstile(token, getRequestIp(req), "<expected_action>")` and FAIL CLOSED on `!success`.
- Allowed hostnames live in `_shared/turnstile.ts` (`ALLOWED_HOSTNAMES`/`ALLOWED_SUFFIXES`) — extend when publishing new domains.

**Currently protected surfaces:**
- `src/pages/Auth.tsx` (internal sign-in)
- `src/pages/portal/PortalLogin.tsx` (supplier portal sign-in)
- `src/pages/portal/PortalAcceptInvite.tsx` (invitation acceptance)
- `src/pages/PublicSupplierRegistration.tsx` → `public-supplier-registration` edge function
- `supplier-accept-invite` edge function

**Supabase Auth (signInWithPassword/signUp/verifyOtp):** Cloudflare Turnstile must also be enabled in Supabase Dashboard → Authentication → Settings → Bot and Abuse Protection, using the same `TURNSTILE_SECRET_KEY`. Without this, the `captchaToken` option is silently ignored.

**Secrets:** `TURNSTILE_SITE_KEY` (public, returned by `turnstile-config` function), `TURNSTILE_SECRET_KEY` (server-only). Test fallback keys are used automatically if secrets are missing so preview keeps working.
