

# Fix: User Creation Failing ("Signups not allowed")

## Problem

User creation fails because the code uses `supabase.auth.signUp()` on the client side, but **signups are disabled** in your Supabase project (this is expected for an admin-provisioned system). The auth logs confirm: `"error_code": "signup_disabled"`.

## Solution

Create a new **Edge Function** (`admin-create-user`) that uses the **service role key** to create users via `supabase.auth.admin.createUser()`, which bypasses the signup restriction. This follows the same pattern as the existing `admin-reset-password` function.

## Changes

### 1. New Edge Function: `supabase/functions/admin-create-user/index.ts`

- Verifies the calling user is authenticated
- Checks admin status via `is_admin` RPC
- Creates user with `supabase.auth.admin.createUser()` using the service role key
- Sets `email_confirm: true` to skip email verification (admin-provisioned)
- Returns the new user ID

### 2. Update: `src/hooks/useUsers.ts` (useCreateUser mutation)

Replace the `supabase.auth.signUp()` call (line 376) with a call to the new Edge Function:

```typescript
// Before (broken):
const { data: authData, error: authError } = await supabase.auth.signUp({ ... });

// After (fixed):
const { data, error } = await supabase.functions.invoke('admin-create-user', {
  body: {
    email: userData.email,
    password: userData.password,
    fullName: userData.fullName,
  }
});
```

- Remove the client-side admin check (lines 330-373) since the Edge Function handles authorization server-side
- Update the response handling to use the user ID returned by the Edge Function
- Keep the existing profile update, role assignment, and module assignment logic

## Security

- Admin authorization is enforced **server-side** in the Edge Function (not client-side)
- Service role key is only used server-side, never exposed to the client
- Follows the same security pattern as the existing `admin-reset-password` function

