/**
 * Debounced React Query invalidation.
 *
 * Coalesces bursts of realtime events (e.g. a 1,000-row bulk import emitting
 * 1k INSERT payloads) into a single refetch per query key per debounce window.
 *
 * Usage:
 *   scheduleInvalidate(queryClient, ["warehouse-tools", companyId]);
 *
 * Default window is 250ms — long enough to swallow a typical insert burst,
 * short enough to feel real-time to the user.
 */
import type { QueryClient, QueryKey } from "@tanstack/react-query";

const timers = new Map<string, ReturnType<typeof setTimeout>>();

const keyToString = (key: QueryKey) => JSON.stringify(key);

export function scheduleInvalidate(
  qc: QueryClient,
  queryKey: QueryKey,
  debounceMs = 250,
) {
  const k = keyToString(queryKey);
  const existing = timers.get(k);
  if (existing) clearTimeout(existing);

  const t = setTimeout(() => {
    timers.delete(k);
    qc.invalidateQueries({ queryKey });
  }, debounceMs);

  timers.set(k, t);
}

/** Cancel any pending invalidation for a key. Useful in tests/teardown. */
export function cancelScheduledInvalidate(queryKey: QueryKey) {
  const k = keyToString(queryKey);
  const existing = timers.get(k);
  if (existing) {
    clearTimeout(existing);
    timers.delete(k);
  }
}
