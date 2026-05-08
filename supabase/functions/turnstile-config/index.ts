// Public endpoint that returns the Turnstile site key so it can be rotated
// without redeploying the frontend. The site key is non-secret by design
// (Cloudflare exposes it in every widget render).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cloudflare's official always-passes test key — used as a safe fallback in
// preview environments before the real key is provisioned.
const TEST_SITE_KEY = "1x00000000000000000000AA";

serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const siteKey = Deno.env.get("TURNSTILE_SITE_KEY") || TEST_SITE_KEY;
  return new Response(
    JSON.stringify({ siteKey, testMode: siteKey === TEST_SITE_KEY }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    },
  );
});
