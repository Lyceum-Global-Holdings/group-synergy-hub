Do I know what the issue is? Yes: the remaining white-screen risk is in the post-login route/bootstrap path, not the visible login form. I found a concrete route mismatch: `MfaEnforcementGate` sends users to `/auth/mfa-setup`, but the app only registers MFA setup at `/account/mfa`. I’ll also harden startup recovery because a white screen can occur before normal route UI appears.

Plan:
1. Correct the MFA setup redirect
   - Change the expired/enforced MFA redirect and banner action from `/auth/mfa-setup` to the existing `/account/mfa` route.
   - Keep `/auth/mfa` reserved for MFA challenge after password login.

2. Make auth redirects safer after login
   - Sanitize any `redirect` query parameter before navigating.
   - Prevent redirects to scanner/base-name paths from the main `stores.lgh.lk` app unless the user is actually in the scanner shell.
   - Fall back to `/` when the stored `from` route is invalid or shell-incompatible.

3. Add a real top-level blank-screen fallback
   - Wrap `createRoot(...).render()` in a startup guard so failures before React route rendering show a recovery screen instead of a blank page.
   - Include safe recovery actions: reload and return to `/auth?app=main`.

4. Strengthen stale deploy/chunk recovery
   - Expand the dynamic-import recovery to handle more browser chunk-load error variants.
   - Clear the one-shot reload guard only after the app has successfully rendered, so users are not stuck on a bad cached deployment.

5. Verify the fix
   - Re-run the login/post-login route flow locally with Playwright using the current `/auth` path.
   - Check that `/`, `/auth`, `/account/mfa`, and scanner paths render a visible UI instead of a blank screen.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>