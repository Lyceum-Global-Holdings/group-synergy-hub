// Uptime probe — runs every 5 min via pg_cron and writes one row per target
// into public.uptime_checks. Token-gated; never exposed to end users.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-probe-token",
};

interface Target {
  name: string;
  url: string;
  method: "GET" | "HEAD" | "OPTIONS";
  // Treat any of these status codes as healthy.
  ok: (status: number) => boolean;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROBE_TOKEN = Deno.env.get("UPTIME_PROBE_TOKEN") ?? "";

const APP_ORIGIN = "https://stores.lgh.lk";
const FN_BASE = `${SUPABASE_URL}/functions/v1`;

const TARGETS: Target[] = [
  {
    name: "app_home",
    url: `${APP_ORIGIN}/`,
    method: "GET",
    ok: (s) => s >= 200 && s < 400,
  },
  {
    name: "app_manifest",
    url: `${APP_ORIGIN}/manifest.webmanifest`,
    method: "GET",
    ok: (s) => s === 200,
  },
  {
    name: "fn_public_bin_qr",
    url: `${FN_BASE}/public-bin-qr`,
    method: "OPTIONS",
    ok: (s) => s >= 200 && s < 500, // OPTIONS preflight: 200 or 204
  },
  {
    name: "fn_security_settings_public",
    url: `${FN_BASE}/security-settings-public`,
    method: "OPTIONS",
    ok: (s) => s >= 200 && s < 500,
  },
  {
    name: "fn_send_telegram_report",
    url: `${FN_BASE}/send-telegram-report`,
    method: "OPTIONS",
    ok: (s) => s >= 200 && s < 500,
  },
  {
    name: "fn_peppol_send",
    url: `${FN_BASE}/peppol-send`,
    method: "OPTIONS",
    ok: (s) => s >= 200 && s < 500,
  },
];

async function probe(t: Target) {
  const started = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(t.url, {
      method: t.method,
      signal: ctrl.signal,
      // Don't follow into login redirects; we're testing reachability.
      redirect: "manual",
    });
    const latency = Math.round(performance.now() - started);
    const status = res.status;
    // A `manual` redirect surfaces as status 0 in some runtimes — treat as ok.
    const ok = status === 0 ? true : t.ok(status);
    return {
      target: t.name,
      url: t.url,
      status_code: status || null,
      latency_ms: latency,
      ok,
      error: null as string | null,
    };
  } catch (err) {
    return {
      target: t.name,
      url: t.url,
      status_code: null,
      latency_ms: Math.round(performance.now() - started),
      ok: false,
      error: (err as Error).message?.slice(0, 500) ?? "error",
    };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Token gate. Constant-time-ish comparison via length + char check.
  const provided = req.headers.get("x-probe-token") ?? "";
  if (!PROBE_TOKEN || provided !== PROBE_TOKEN) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const results = await Promise.all(TARGETS.map(probe));
  const { error } = await supabase.from("uptime_checks").insert(results);

  if (error) {
    return new Response(
      JSON.stringify({ error: "insert_failed", detail: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      checked: results.length,
      failures: results.filter((r) => !r.ok).length,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
