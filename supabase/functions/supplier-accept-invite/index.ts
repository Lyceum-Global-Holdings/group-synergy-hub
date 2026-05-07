// Authenticated supplier portal invite acceptance.
// User must be logged in (any auth user). We hash the supplied token, find a live
// invitation, ensure email matches the auth user, then create supplier_users + mark accepted.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  invitation_id: z.string().uuid(),
  token: z.string().min(32).max(128),
});

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Login required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supaUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Login required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { invitation_id, token } = parsed.data;
    const tokenHash = await sha256Hex(token);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: inv, error: invErr } = await admin
      .from("supplier_invitations")
      .select("*")
      .eq("id", invitation_id)
      .maybeSingle();

    if (invErr || !inv) {
      return new Response(JSON.stringify({ error: "Invitation not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (inv.token_hash !== tokenHash) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (inv.accepted_at) {
      return new Response(JSON.stringify({ error: "Invitation already accepted" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (inv.revoked_at) {
      return new Response(JSON.stringify({ error: "Invitation revoked" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Invitation expired" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userEmail = (user.email ?? "").toLowerCase();
    if (userEmail !== String(inv.email).toLowerCase()) {
      return new Response(
        JSON.stringify({ error: `Logged-in email does not match invitation (${inv.email})` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Upsert supplier_users (one row per (supplier_id,user_id))
    const { error: suErr } = await admin
      .from("supplier_users")
      .upsert(
        {
          supplier_id: inv.supplier_id,
          user_id: user.id,
          portal_role: inv.portal_role,
          is_active: true,
          invited_by: inv.invited_by,
          invited_at: inv.created_at,
          accepted_at: new Date().toISOString(),
        },
        { onConflict: "supplier_id,user_id" },
      );
    if (suErr) {
      console.error("supplier_users upsert", suErr);
      return new Response(JSON.stringify({ error: suErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("supplier_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", inv.id);

    // Best-effort audit log
    await admin.rpc("log_supplier_portal_event", {
      _supplier_id: inv.supplier_id,
      _event_type: "invitation_accepted",
      _payload: { invitation_id: inv.id, user_id: user.id },
    }).catch((e: unknown) => console.warn("audit log failed", e));

    return new Response(
      JSON.stringify({ success: true, supplier_id: inv.supplier_id, portal_role: inv.portal_role }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("supplier-accept-invite error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
