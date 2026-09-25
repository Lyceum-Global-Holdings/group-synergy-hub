import { supabase } from "@/integrations/supabase/client";

/** Maximum rows any report returns (preview, charts and exports). */
export const REPORT_ROW_CAP = 10_000;

type RpcResult = { data: Record<string, unknown>[] | null; error: { message: string; code?: string } | null; truncated: boolean };

// Set by rpcAll when a result hits the cap; read by buildReportEnvelope.
let currentRun: { truncated: boolean } | null = null;
export function beginReportRun() {
  currentRun = { truncated: false };
  return currentRun;
}

/**
 * Call a set-returning report RPC and collect every row up to `cap`.
 *
 * The Supabase Data API returns at most "Max rows" (1,000 by default) per
 * request regardless of the function's own LIMIT, which silently cut every
 * report at 1,000 rows. This pages with limit/offset until a short page shows
 * the end. If the server's page size is raised to ≥ cap, it's a single call.
 */
export async function rpcAll(fn: string, args: Record<string, unknown>, cap = REPORT_ROW_CAP): Promise<RpcResult> {
  const rows: Record<string, unknown>[] = [];
  let firstPage = 0;

  while (rows.length < cap) {
    const { data, error } = await (supabase.rpc as any)(fn, args).range(rows.length, cap - 1);
    if (error) return { data: null, error, truncated: false };
    if (!Array.isArray(data)) return { data, error: null, truncated: false }; // scalar / json result
    if (data.length === 0) break;
    rows.push(...data);
    if (!firstPage) firstPage = data.length;
    // Every page but the last comes back at the server's page size.
    else if (data.length < firstPage) break;
  }

  const truncated = rows.length >= cap;
  if (truncated && currentRun) currentRun.truncated = true;
  return { data: rows.slice(0, cap), error: null, truncated };
}
