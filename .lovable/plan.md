# Multi-Factor Authentication (MFA) Implementation

Implement TOTP (Time-based One-Time Password) MFA using Supabase Auth's built-in MFA, aligned with international standards:
- **NIST SP 800-63B AAL2** (authenticator assurance level 2)
- **RFC 6238** (TOTP) / **RFC 4226** (HOTP)
- Compatible with Google Authenticator, Microsoft Authenticator, 1Password, Authy

SMS MFA is intentionally excluded — NIST deprecated SMS as a restricted authenticator due to SIM-swap risk.

## What gets built

### 1. Enrollment flow (user-initiated)
New page: `src/pages/auth/MfaSetup.tsx` (route `/account/mfa`)
- Calls `supabase.auth.mfa.enroll({ factorType: 'totp' })`
- Displays QR code + secret for manual entry
- User enters 6-digit code → `supabase.auth.mfa.challenge` + `verify` to confirm enrollment
- On success: generates and displays **10 one-time recovery codes** (stored hashed in a new `user_mfa_recovery_codes` table)
- "Download / copy codes" UI before continuing

### 2. Login challenge flow
Update `src/pages/Auth.tsx` + `AuthContext`:
- After `signInWithPassword` succeeds, call `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`
- If `currentLevel === 'aal1'` and `nextLevel === 'aal2'` → render TOTP challenge step (6-digit input)
- Submit via `mfa.challenge` + `mfa.verify` → session is upgraded to AAL2
- "Use a recovery code instead" link → verifies against hashed codes via edge function (marks code consumed)

### 3. Route guard upgrade
Update `ProtectedRoute.tsx`:
- Read AAL via `getAuthenticatorAssuranceLevel()`
- If user has an enrolled factor but session is AAL1 → redirect to `/auth/mfa-challenge`
- Admin-policy hook: optionally enforce MFA for users with `admin` / `super_admin` roles (read from `user_roles`); non-enrolled admins are redirected to `/account/mfa` on next login

### 4. Account management
New section in user profile/settings:
- List enrolled factors (`mfa.listFactors`)
- Unenroll factor (requires fresh AAL2 session)
- Regenerate recovery codes

### 5. Backend (Supabase)
Migration adds:
- `user_mfa_recovery_codes` table: `id`, `user_id`, `code_hash` (bcrypt/sha256), `consumed_at`, `created_at`
- RLS: users can only `SELECT` their own rows; inserts/updates only via SECURITY DEFINER RPCs
- RPC `generate_mfa_recovery_codes()` — creates 10 codes, returns plaintext once
- RPC `consume_mfa_recovery_code(code text)` — verifies + marks consumed atomically

Edge function `mfa-recovery-verify`:
- JWT-validated; calls the consume RPC; on success uses admin API to issue a step-up (or instructs client to re-enroll)

Supabase Dashboard config (manual, documented in chat after deploy):
- Auth → Providers → enable TOTP factor (already on by default)
- Optional: enforce AAL2 for sensitive RLS via `(SELECT auth.jwt()->>'aal') = 'aal2'`

## Technical notes

- Use `qrcode` npm package for QR rendering (no external service — secret stays client-side)
- Recovery codes: 10 × 10-char base32, hashed with `crypto.subtle` SHA-256 + per-code salt before storage
- All MFA endpoints rate-limited via Supabase's built-in protections (no extra work)
- `staleTime: 0` on `useAuthAssuranceLevel` hook so AAL changes propagate immediately

## Files

Created:
- `src/pages/auth/MfaSetup.tsx`
- `src/pages/auth/MfaChallenge.tsx`
- `src/components/auth/RecoveryCodesDisplay.tsx`
- `src/hooks/useMfa.ts`
- `supabase/migrations/<timestamp>_mfa_recovery_codes.sql`
- `supabase/functions/mfa-recovery-verify/index.ts`

Edited:
- `src/contexts/AuthContext.tsx` — expose `aal`, `mfaRequired`, `verifyTotp`
- `src/pages/Auth.tsx` — TOTP challenge step
- `src/components/common/ProtectedRoute.tsx` — AAL2 enforcement
- `src/components/common/UserProfile.tsx` — MFA management entry point
- `src/App.tsx` — new routes
- `supabase/config.toml` — `[functions.mfa-recovery-verify] verify_jwt = true`
- `package.json` — add `qrcode`, `@types/qrcode`

## Out of scope (can add later)
- WebAuthn / passkeys (AAL3)
- SMS / email OTP (not recommended by NIST)
- Per-organization MFA enforcement policies UI
