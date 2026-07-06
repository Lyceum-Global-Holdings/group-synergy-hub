// Cached accessor for the signed-in user's id.
//
// `supabase.auth.getUser()` makes a NETWORK round-trip to the auth server to
// revalidate the JWT. Calling it inside React Query `queryFn`s / mutations (as
// the app did in ~200 places) adds a serial round-trip before every data op.
// The session is already available locally, so we cache the user id here —
// seeded from `getSession()` (local, no network) and kept fresh via
// `onAuthStateChange` — and expose a synchronous accessor.
//
// Security is unaffected: Postgres RLS (`auth.uid()`) remains the real
// enforcement. These client-side reads only supply `created_by`/`user_id` and
// convenience guards.
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

let cachedUser: User | null = null;
let warmed = false;

// Seed once from local storage (no network) and keep in sync with auth changes.
supabase.auth.getSession().then(({ data }) => {
  cachedUser = data.session?.user ?? null;
  warmed = true;
});

supabase.auth.onAuthStateChange((_event, session) => {
  cachedUser = session?.user ?? null;
  warmed = true;
});

/** Current user id from the in-memory session, or null. Synchronous, no network. */
export function getCachedUserId(): string | null {
  return cachedUser?.id ?? null;
}

/** Current user object from the in-memory session, or null. */
export function getCachedUser(): User | null {
  return cachedUser;
}

/**
 * User id, awaiting a one-time local `getSession()` if the cache hasn't warmed
 * yet (rare — only very early in app boot). Still no network beyond the initial
 * local session read.
 */
export async function ensureUserId(): Promise<string | null> {
  if (warmed) return cachedUser?.id ?? null;
  const { data } = await supabase.auth.getSession();
  cachedUser = data.session?.user ?? null;
  warmed = true;
  return cachedUser?.id ?? null;
}
