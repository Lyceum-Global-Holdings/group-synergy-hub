/**
 * Phase 5 — Slow-query interceptor for the Supabase client.
 *
 * Wraps `supabase.rpc()` and `supabase.from()` so we can time hot paths and
 * record anything >1s to the same telemetry buffer used by Web Vitals.
 *
 * Drop-in: behaviour is identical to the underlying client. The proxy only
 * adds a `.then()` tap that times the resolved promise.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { recordSlowQuery } from "@/lib/perfTelemetry";

const SLOW_QUERY_THRESHOLD_MS = 1000;

function timePromise<T extends Promise<unknown>>(
  p: T,
  label: string,
  kind: "rpc" | "table",
): T {
  const start = performance.now();
  // We must return the same promise type — cast through unknown.
  return p.then(
    (value) => {
      const dur = performance.now() - start;
      if (dur >= SLOW_QUERY_THRESHOLD_MS) {
        try {
          recordSlowQuery(label, dur, kind);
        } catch {
          /* never break the caller */
        }
      }
      return value;
    },
    (err) => {
      const dur = performance.now() - start;
      if (dur >= SLOW_QUERY_THRESHOLD_MS) {
        try {
          recordSlowQuery(label, dur, kind);
        } catch {
          /* never break */
        }
      }
      throw err;
    },
  ) as unknown as T;
}

/**
 * Wrap an existing Supabase client to add slow-query telemetry.
 * Returns the same client reference with `rpc` and `from` patched.
 */
export function installPerfInterceptor(client: SupabaseClient<any>): SupabaseClient<any> {
  const w = client as unknown as { __perfInstalled?: boolean };
  if (w.__perfInstalled) return client;
  w.__perfInstalled = true;

  const originalRpc = client.rpc.bind(client);
  const originalFrom = client.from.bind(client);

  // rpc(): the returned PostgrestFilterBuilder is thenable — wrap its `then`.
  (client as any).rpc = (fn: string, args?: unknown, opts?: unknown) => {
    const builder: any = originalRpc(fn as any, args as any, opts as any);
    const originalThen = builder.then?.bind(builder);
    if (originalThen) {
      builder.then = (onFulfilled?: any, onRejected?: any) =>
        timePromise(originalThen(onFulfilled, onRejected), `rpc:${fn}`, "rpc");
    }
    return builder;
  };

  // from().select(): same pattern — patch the select builder's then.
  (client as any).from = (table: string) => {
    const tableBuilder: any = originalFrom(table as any);
    const originalSelect = tableBuilder.select?.bind(tableBuilder);
    if (originalSelect) {
      tableBuilder.select = (...selectArgs: unknown[]) => {
        const sel: any = originalSelect(...selectArgs);
        const originalThen = sel.then?.bind(sel);
        if (originalThen) {
          sel.then = (onFulfilled?: any, onRejected?: any) =>
            timePromise(originalThen(onFulfilled, onRejected), `table:${table}`, "table");
        }
        return sel;
      };
    }
    return tableBuilder;
  };

  return client;
}
