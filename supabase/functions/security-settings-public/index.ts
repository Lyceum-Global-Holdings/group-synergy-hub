// Public, unauthenticated read of the *non-sensitive* security flags that
// pre-auth screens (login, signup, public registration) need to decide
// whether to render the Turnstile widget. Never exposes audit data or any
// user-identifying field.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK = {
  turnstile_enabled: true,
  turnstile_surfaces: {
    auth: true,
    portal_login: true,
    portal_invite: true,
    public_registration: true,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await sb
      .from("security_settings")
      .select("turnstile_enabled, turnstile_surfaces")
      .eq("id", "global")
      .maybeSingle();

    const body = error || !data ? FALLBACK : data;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30",
      },
    });
  } catch (e) {
    console.error("security-settings-public failed", e);
    return new Response(JSON.stringify(FALLBACK), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
