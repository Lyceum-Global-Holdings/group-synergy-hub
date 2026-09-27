// Admin-only: create a supplier portal invitation.
// Returns a one-time raw token (only shown to admin); only the SHA-256 hash is persisted.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { appUrl, emailLayout, escapeHtml, sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  supplier_id: z.string().uuid(),
  email: z.string().email().max(254),
  portal_role: z.enum(["owner", "admin", "user", "viewer"]).default("user"),
  expires_in_hours: z.number().int().min(1).max(720).default(168),
  company_id: z.string().uuid().optional(),
});

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supaUser.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = parsed.data;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify supplier exists and grab company_id if not supplied
    const { data: supplier, error: supErr } = await admin
      .from("suppliers")
      .select("id, name, company_id")
      .eq("id", body.supplier_id)
      .maybeSingle();
    if (supErr || !supplier) {
      return new Response(JSON.stringify({ error: "Supplier not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = generateToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + body.expires_in_hours * 3600_000).toISOString();

    const { data: inv, error: invErr } = await admin
      .from("supplier_invitations")
      .insert({
        supplier_id: body.supplier_id,
        company_id: body.company_id ?? supplier.company_id,
        email: body.email.toLowerCase(),
        portal_role: body.portal_role,
        token_hash: tokenHash,
        expires_at: expiresAt,
        invited_by: user.id,
      })
      .select("id, supplier_id, email, portal_role, expires_at")
      .single();

    if (invErr) {
      console.error("supplier-invite insert error", invErr);
      return new Response(JSON.stringify({ error: invErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const acceptUrl = `${appUrl(req)}/portal/accept-invite?token=${token}&id=${inv.id}`;

    const hours = body.expires_in_hours;
    const validFor = hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? "" : "s"}` : `${hours} hours`;
    const email = await sendEmail({
      to: inv.email,
      subject: `You're invited to the ${supplier.name} supplier portal`,
      html: emailLayout({
        heading: "Join the supplier portal",
        body: `<p>You've been invited to the supplier portal for <b>${escapeHtml(supplier.name)}</b>. There you can answer requests for quotation, submit invoices against purchase orders, and keep your company details up to date.</p>
               <p>Open the link below, then set a password for <b>${escapeHtml(inv.email)}</b> (or sign in if you already have an account). The link works once and expires in ${validFor}.</p>`,
        action: { label: "Accept invitation", url: acceptUrl },
      }),
      text: `You've been invited to the supplier portal for ${supplier.name}. Accept the invitation (link valid ${validFor}): ${acceptUrl}`,
    });
    if (!email.sent) console.warn("supplier-invite email not sent:", email.error);

    return new Response(
      JSON.stringify({ success: true, invitation: inv, accept_url: acceptUrl, token, email_sent: email.sent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("supplier-invite error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
