// Public, unauthenticated bin-allocation lookup for the /b/:id QR route.
// Hardening:
//   - Strict UUID validation on `id` (canonical form, RFC 4122).
//   - Optional Cloudflare Turnstile gate (surface "public_qr"); fails closed
//     when admins enable it from /admin/security.
//   - Allow-listed JSON projection — never echoes future RPC columns.
//   - Generic error messages (no DB error leakage), 404 for not found.
//   - Short edge cache (60s) so repeat scans don't re-hit the DB.
//
// Backend rate limiting is intentionally NOT implemented (project policy).
// Turnstile + edge cache are the abuse mitigations we ship.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyTurnstile, getRequestIp } from "../_shared/turnstile.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, cf-turnstile-token",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Strict allow-list of fields that may be returned to anonymous callers.
const ALLOWED_KEYS = [
  "id",
  "item_code",
  "item_name",
  "bin_code",
  "bin_name",
  "location_name",
  "location_code",
  "company_name",
  "allocated_quantity",
  "available_quantity",
  "updated_at",
] as const;

function pick(src: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED_KEYS) {
    out[k] = src[k] ?? null;
  }
  return out;
}

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "method-not-allowed" }, 405);

  // --- 1. Canonical UUID validation ------------------------------------
  const url = new URL(req.url);
  const id = (url.searchParams.get("id") || "").trim();
  if (!UUID_RE.test(id)) {
    return json({ error: "invalid-id" }, 400);
  }

  // --- 2. Optional Turnstile gate (surface = public_qr) ---------------
  const token = req.headers.get("cf-turnstile-token") || undefined;
  const ts = await verifyTurnstile(token, getRequestIp(req), "public_qr", "public_qr");
  if (!ts.success) {
    return json({ error: "captcha-required" }, ts.status);
  }

  // --- 3. Fetch via SECURITY DEFINER RPC ------------------------------
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await sb.rpc("get_public_bin_allocation_qr", { p_id: id });
    if (error) {
      console.error("public-bin-qr rpc failed", error);
      return json({ error: "lookup-failed" }, 500);
    }
    if (!data || typeof data !== "object") {
      return json({ error: "not-found" }, 404);
    }

    // --- 4. Allow-listed projection ----------------------------------
    const safe = pick(data as Record<string, unknown>);
    return json(safe, 200, {
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
  } catch (e) {
    console.error("public-bin-qr unexpected error", e);
    return json({ error: "lookup-failed" }, 500);
  }
});
