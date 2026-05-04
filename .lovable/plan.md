# MFA End-to-End Test Suite

Set up Vitest + React Testing Library and add a comprehensive test suite for the MFA flow (enrollment, login challenge, verification, recovery code, failure paths).

The Supabase Auth MFA API and the `generate_mfa_recovery_codes` / `consume_mfa_recovery_code` RPCs are mocked at the `@/integrations/supabase/client` boundary so tests run fast and offline (no live Supabase calls). This is the standard pattern for E2E-style component tests in a Vite/React project.

## New / changed files

### Test infrastructure
- `package.json` — add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`. Add devDeps: `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@vitejs/plugin-react-swc` (already present as a dep, but ensured in dev).
- `vitest.config.ts` — jsdom env, `@` alias, `src/test/setup.ts` setup file.
- `src/test/setup.ts` — `@testing-library/jest-dom`, polyfills for `matchMedia`, `URL.createObjectURL`, `scrollIntoView`, `navigator.clipboard`.
- `tsconfig.app.json` — add `"vitest/globals"` and `"@testing-library/jest-dom"` to `types`.

### Shared mocks
- `src/test/mfaMocks.ts` — in-memory mock of the Supabase auth + MFA + RPC surface used by the MFA pages. Exposes `resetMfaMockState()`, `mfaState` (factors, AAL, recovery codes), and `supabaseMock`. Verify code `"123456"` succeeds; anything else fails. Recovery codes generated only when AAL=aal2; consume marks them used (one-time).
- `src/test/qrcodeMock.ts` — stubs `qrcode` to return a fixed data URL (avoids canvas in jsdom).

### Test cases
- `src/pages/auth/__tests__/MfaSetup.test.tsx`
  1. **Enrollment happy path** — clicks "Enable two-factor authentication" → QR rendered with secret → submits `123456` → recovery codes step shown with 10 codes.
  2. **Friendly-name conflict cleanup** — pre-seed an unverified factor with a name that would collide; assert `unenroll` was called and enrollment still succeeds.
  3. **Invalid verification code** — submits `000000` → toast "Verification failed", remains on verify step, factor not marked verified.
  4. **Recovery codes copy/download** — clicks Copy and Download buttons; asserts `navigator.clipboard.writeText` and a Blob anchor click.
  5. **Existing verified factor** — `Regenerate recovery codes` button visible; click generates new codes and invalidates old set.

- `src/pages/auth/__tests__/MfaChallenge.test.tsx`
  1. **TOTP success** — verified factor present, AAL=aal1; submit `123456` → navigates to `/`.
  2. **TOTP failure** — submit `000000` → error toast, stays on `/auth/mfa`, AAL stays aal1.
  3. **Recovery code success** — toggle "Use a recovery code", submit a valid code → navigates to `/account/mfa` and prompts re-enrollment.
  4. **Recovery code reuse fails** — consume same code twice; second attempt shows "Invalid or already-used recovery code."
  5. **Auto-redirect when no MFA needed** — AAL already `aal2` or no verified factor → effect navigates away from `/auth/mfa`.
  6. **Sign-out from challenge** — clicks "Sign out" → `supabase.auth.signOut` called, navigates to `/auth`.

- `src/components/common/__tests__/ProtectedRoute.test.tsx`
  1. **Unauthenticated** → redirects to `/auth`.
  2. **Authenticated, no MFA enrolled** → renders children.
  3. **Authenticated, MFA enrolled, AAL1** → redirects to `/auth/mfa`.
  4. **Authenticated, AAL2** → renders children even with verified factor.

All tests use a small `renderWithRouter` helper that wraps the component in `MemoryRouter`, mocks `react-router-dom`'s `useNavigate` via spy, and resets `mfaState` in `beforeEach`. The `useToast` hook is also spied on so failure cases can assert toast variants without needing a real `<Toaster />`.

## How to run

`bun run test` (or `bunx vitest run`) — also wired up so the harness's standard test runner picks them up automatically.
