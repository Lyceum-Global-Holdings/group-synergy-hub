import { supabase } from "@/integrations/supabase/client";

/**
 * Calls a database function that is newer than the generated Supabase types
 * (Lovable regenerates src/integrations/supabase/types.ts after migrations run).
 */
export async function untypedRpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (
    supabase as unknown as {
      rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: T; error: { message: string } | null }>;
    }
  ).rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}
