/**
 * Shared Realtime Bus.
 *
 * Opens ONE Supabase channel per table at app mount and dispatches
 * `postgres_changes` payloads to in-memory subscribers via a tiny event
 * emitter. Replaces ad-hoc per-page channels — page mounts no longer open
 * new WebSocket subscriptions; they just attach a listener.
 *
 * Usage in feature code:
 *   useRealtimeChannel("warehouse_tools", (payload) => {
 *     const cid = (payload.new ?? payload.old)?.company_id;
 *     scheduleInvalidate(qc, ["warehouse-tools", cid]);
 *   });
 *
 * NEVER call `supabase.channel()` directly in feature code — always go
 * through this bus so the WebSocket count stays bounded.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

type AnyPayload = RealtimePostgresChangesPayload<Record<string, any>>;
type Handler = (payload: AnyPayload) => void;

interface BusEntry {
  channel: RealtimeChannel;
  handlers: Set<Handler>;
  refCount: number;
}

interface BusApi {
  subscribe: (table: string, handler: Handler) => () => void;
}

const BusContext = createContext<BusApi | null>(null);

/**
 * Mount once near the top of the app (inside <AppLayout>).
 * Holds the channel registry for the lifetime of the session.
 */
export function RealtimeBusProvider({ children }: { children: ReactNode }) {
  // Registry of table -> channel + handler set. Stable across renders.
  const registryRef = useRef<Map<string, BusEntry>>(new Map());

  const api = useMemo<BusApi>(
    () => ({
      subscribe(table, handler) {
        const registry = registryRef.current;
        let entry = registry.get(table);

        if (!entry) {
          // First subscriber for this table — open the channel.
          const handlers = new Set<Handler>();
          const channel = supabase
            .channel(`bus:${table}`)
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table },
              (payload) => {
                handlers.forEach((h) => {
                  try {
                    h(payload as AnyPayload);
                  } catch {
                    // Swallow handler errors so one bad subscriber doesn't
                    // poison the rest.
                  }
                });
              },
            )
            .subscribe();

          entry = { channel, handlers, refCount: 0 };
          registry.set(table, entry);
        }

        entry.handlers.add(handler);
        entry.refCount += 1;

        return () => {
          const e = registry.get(table);
          if (!e) return;
          e.handlers.delete(handler);
          e.refCount -= 1;
          if (e.refCount <= 0) {
            supabase.removeChannel(e.channel);
            registry.delete(table);
          }
        };
      },
    }),
    [],
  );

  // Tear down all channels when the provider unmounts (full app teardown).
  useEffect(() => {
    const registry = registryRef.current;
    return () => {
      registry.forEach((e) => {
        try {
          supabase.removeChannel(e.channel);
        } catch {
          // ignore
        }
      });
      registry.clear();
    };
  }, []);

  return <BusContext.Provider value={api}>{children}</BusContext.Provider>;
}

/**
 * Subscribe to all postgres_changes events on a given table.
 * The handler is called with the raw payload (event, new, old, ...).
 *
 * Re-subscribes if `table` or `handler` identity changes — pass a stable
 * (useCallback-wrapped) handler to avoid churn.
 */
export function useRealtimeChannel(table: string, handler: Handler) {
  const ctx = useContext(BusContext);
  useEffect(() => {
    if (!ctx) {
      // Bus provider not mounted yet (e.g. during initial app boot before
      // AppLayout). Silently skip — feature code can re-render once mounted.
      return;
    }
    const unsubscribe = ctx.subscribe(table, handler);
    return unsubscribe;
  }, [ctx, table, handler]);
}
