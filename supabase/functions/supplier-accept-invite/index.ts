// Supplier portal invite acceptance.
// Two ways in:
//  • signed in: the account's email must match the invitation;
//  • new to the portal: the body carries a password, and we create the login for
//    the invited email (the single-use, expiring token is the proof of invite).
// Either way we hash the supplied token, find a live invitation, then create
// supplier_users + mark accepted.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { verifyTurnstile, getRequestIp } from "../_shared/turnstile.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  invitation_id: z.string().uuid(),
  token: z.string().min(32).max(128),
  turnstile_token: z.string().min(10).max(2048).optional(),
  // Only when creating a new login from the invitation.
  password: z.string().min(8).max(72).optional(),
  full_name: z.string().trim().max(200).optional(),
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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const passwordIssue = parsed.error.issues.some((i) => i.path[0] === "password");
      return new Response(
        JSON.stringify({ error: passwordIssue ? "Password must be 8 to 72 characters" : "Invalid invitation link" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { invitation_id, token, turnstile_token, password, full_name } = parsed.data;
    const creatingAccount = !!password;

    // Existing account: the caller must be signed in.
    let user: { id: string; email?: string } | null = null;
    if (!creatingAccount) {
      const authHeader = req.headers.get("Authorization");
      const supaUser = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader ?? "" } },
      });
      const { data, error: userErr } = await supaUser.auth.getUser();
      if (userErr || !data.user) {
        return new Response(JSON.stringify({ error: "Login required" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      user = data.user;
    }

    // Bot protection
    const captcha = await verifyTurnstile(turnstile_token, getRequestIp(req), "supplier_accept_invite", "portal_invite");
    if (!captcha.success) {
      return new Response(
        JSON.stringify({ error: "Bot protection check failed", code: captcha.error }),
        { status: captcha.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    if (creatingAccount) {
      // New login for exactly the invited email. The invite link stands in for
      // the email confirmation, so the address is marked confirmed.
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: String(inv.email).toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || null, source: "supplier_invite" },
      });
      if (createErr || !created?.user) {
        const exists = /already.*(registered|exists)/i.test(createErr?.message ?? "");
        return new Response(
          JSON.stringify({
            error: exists
              ? `An account already exists for ${inv.email}. Sign in with it, then accept the invitation.`
              : "Could not create your account. Try again.",
            code: exists ? "account_exists" : "create_failed",
          }),
          { status: exists ? 409 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      user = created.user;
    } else {
      const userEmail = (user!.email ?? "").toLowerCase();
      if (userEmail !== String(inv.email).toLowerCase()) {
        return new Response(
          JSON.stringify({ error: `Logged-in email does not match invitation (${inv.email})` }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }
    const member = user!;

    // Upsert supplier_users (one row per (supplier_id,user_id))
    const { error: suErr } = await admin
      .from("supplier_users")
      .upsert(
        {
          supplier_id: inv.supplier_id,
          user_id: member.id,
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
      _action: "invitation_accepted",
      _metadata: { invitation_id: inv.id, user_id: member.id, account_created: creatingAccount },
    }).catch((e: unknown) => console.warn("audit log failed", e));

    return new Response(
      JSON.stringify({
        success: true,
        supplier_id: inv.supplier_id,
        portal_role: inv.portal_role,
        email: inv.email,
        account_created: creatingAccount,
      }),
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
