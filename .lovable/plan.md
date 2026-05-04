# Fix "Friendly name already exists" MFA enrollment error

## Problem
Supabase Auth requires `friendlyName` to be unique per user across **all** factors (verified + unverified). The current cleanup only iterates `factors.totp`, missing factors listed under `factors.all`, and re-uses a date-only friendly name so retries within the same day collide (RFC 6238 says nothing about names, but Supabase's uniqueness constraint does).

## Fix in `src/pages/auth/MfaSetup.tsx` (`startEnrollment`)

1. Iterate `factors.all` (not just `factors.totp`) when sweeping unverified factors so any stale enrollment is removed.
2. Generate a guaranteed-unique `friendlyName` using a high-resolution timestamp + random suffix, e.g. `Authenticator ${Date.now().toString(36)}-${rand4}`.
3. If `enroll` still throws `MFAFactorNameConflictError` (Supabase error code `mfa_factor_name_conflict`), retry once with a fresh suffix — defensive against race conditions.
4. Show a clearer toast when the user already has a verified factor (route them to "Regenerate recovery codes" instead of re-enrolling).

No DB / RLS changes. No standards-affecting changes — TOTP per RFC 6238 / NIST SP 800-63B AAL2 remains intact.
