import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") || "https://group-synergy-hub.lovable.app";

const EMAIL_FROM = "Lyceum Procurement <notifications@resend.dev>";

const EVENT_TYPES = [
  "rfq_published",
  "quotation_received",
  "quotation_awarded",
  "supplier_registered",
  "supplier_blacklisted",
  "generic",
] as const;
type EventType = (typeof EVENT_TYPES)[number];

// Roles that receive notifications when no explicit recipients are given
const DEFAULT_RECIPIENT_ROLES = ["super_admin", "admin", "manager"];

const MAX_RECIPIENTS = 10;

interface NotifyBody {
  company_id?: string;
  event_type?: string;
  title?: string;
  message?: string;
  reference?: string;
  entity_url?: string;
  recipients?: string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanText(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildEmail(
  eventType: EventType,
  title: string,
  message: string,
  reference: string,
  link: string
): { subject: string; html: string } {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br/>");
  const safeRef = escapeHtml(reference前后 || reference);
  void safeRef;
  const safeReference = escapeHtml(reference);

  const accent =
    eventType === "supplier_blacklisted" ? "#dc2626" : "#2563eb";

  const refBlock = safeReference
    ? `<p style="margin:5px 0;"><strong>Reference:</strong> ${safeReference}</p>`
    : "";

  const msgBlock = safeMessage
    ? `<p style="margin:15px 0;">${safeMessage}</p>`
    : "";

  const linkBlock = link
    ? `<div style="margin:30px 0;">
         <a href="${link}" style="background-color: ${accent}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
           Open in Procurement System
         </a>
       </div>`
    : "";

  return {
    subject: `${title}${safeReference ? ` — ${safeReference}` : ""}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${accent}; border-left: 4px solid ${accent}; padding-left: 12px;">${safeTitle}</h2>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
          ${refBlock}
        </div>
        ${msgBlock}
        ${linkBlock}
        <p style="color: #6b7280; font-size: 14px;">This is an automated notification from your Procurement System.</p>
      </div>
    `,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    // ── Authenticate the caller ──────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json(401, { error: "Unauthorized" });
    }
    const userId = claimsData.claims.sub as string;

    // ── Validate input ──────────────────────────────────────────────────
    const body = (await req.json().catch(() => null)) as NotifyBody | null;
    if (!body || typeof body !== "object") {
      return json(400, { error: "Invalid JSON body" });
    }

    const companyId = cleanText(body.company_id, 64);
    if (!UUID_RE.test(companyId)) {
      return json(400, { error: "Valid company_id is required" });
    }

    const eventType = cleanText(body.event_type, 50) as EventType;
    if (!EVENT_TYPES.includes(eventType)) {
      return json(400, {
        error: `Invalid event_type. Allowed: ${EVENT_TYPES.join(", ")}`,
      });
    }

    const title = cleanText(body.title, 200) || "Sourcing Notification";
    const message = cleanText(body.message, 2000);
    const reference = cleanText(body.reference, 100);

    let entityUrl = cleanText(body.entity_url, 500);
    if (entityUrl && !entityUrl.startsWith("/")) entityUrl = "";
    const link = entityUrl
      ? `${APP_URL}${entityUrl}`
      : `${APP_URL}/sourcing/rfq-management`;

    // Provided recipients: validated emails only
    let providedRecipients: string[] = [];
    if (Array.isArray(body.recipients)) {
      providedRecipients = body.recipients
        .filter((r): r is string => typeof r === "string")
        .map((r) => r.trim().toLowerCase())
        .filter((r) => EMAIL_RE.test(r) && r.length <= 255)
        .slice(0, MAX_RECIPIENTS);
    }

    // Service client for lookups (recipient resolution, telegram settings)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Verify caller belongs to this company (or is a super admin) ────
    const { data: callerProfile } = await serviceClient
      .from("profiles")
      .select("role, company_id")
      .eq("user_id", userId)
      .eq("deactivated_at", "is", null)
      .maybeSingle();

    if (!callerProfile) {
      return json(403, { error: "Profile not found" });
    }

    const isSuperAdmin = callerProfile.role === "super_admin";
    const isMember =
      callerProfile.company_id === companyId || isSuperAdmin;
    if (!isMember) {
      return json(403, { error: "Access denied to this company" });
    }

    // ── Resolve recipients ──────────────────────────────────────────────
    let to: string[] = [];

    if (providedRecipients.length > 0) {
      // Restrict provided recipients to active members of the same company
      const { data: members } = await serviceClient
        .from("profiles")
        .select("email")
        .eq("company_id", companyId)
        .eq("deactivated_at", "is", null)
        .in("email", providedRecipients);

      const memberEmails = new Set(
        (members ?? []).map((m: { email: string | null }) =>
          (m.email ?? "").toLowerCase()
        )
      );
      to = providedRecipients.filter((r) => memberEmails.has(r));
    } else {
      const { data: staff } = await serviceClient
        .from("profiles")
        .select("email")
        .eq("company_id", companyId)
        .eq("deactivated_at", "is", null)
        .in("role", DEFAULT_RECIPIENT_ROLES);

      to = Array.from(
        new Set(
          (staff ?? [])
            .map((s: { email: string | null }) => (s.email ?? "").toLowerCase())
            .filter((e: string) => EMAIL_RE.test(e))
        )
      ).slice(0, MAX_RECIPIENTS);
    }

    if (to.length === 0) {
      return json(422, {
        error:
          "No recipients resolved. Provide recipients (active members of this company) or ensure the company has admin/manager users.",
      });
    }

    // ── Send email ──────────────────────────────────────────────────────
    let emailSent = false;
    let emailError: string | null = null;

    if (RESEND_API_KEY) {
      const { subject, html } = buildEmail(eventType, title, message, reference, link);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
      });
      if (res.ok) {
        emailSent = true;
      } else {
        emailError = (await res.text()).slice(0, 300);
      }
    } else {
      emailError = "RESEND_API_KEY not configured";
    }

    // ── Telegram (optional, per company settings) ───────────────────────
    let telegramSent = false;
    let telegramError: string | null = null;

    const { data: tgSettings } = await serviceClient
      .from("telegram_settings")
      .select("bot_token, chat_id, is_enabled")
      .eq("company_id", companyId)
      .maybeSingle();

    if (tgSettings?.is_enabled && tgSettings.bot_token && tgSettings.chat_id) {
      const text = [
        `📢 ${title}`,
        reference ? `Ref: ${reference}` : "",
        message,
        link,
      ]
        .filter(Boolean)
        .join("\n");

      const tgRes = await fetch(
        `https://api.telegram.org/bot${tgSettings.bot_token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: tgSettings.chat_id,
            text,
            parse_mode: "HTML",
          }),
        }
      );
      if (tgRes.ok) {
        telegramSent = true;
      } else {
        telegramError = (await tgRes.text()).slice(0, 300);
      }
    }

    return json(200, {
      success: emailSent || telegramSent,
      event_type: eventType,
      recipients: to,
      email_sent: emailSent,
      email_error: emailError,
      telegram_sent: telegramSent,
      telegram_error: telegramError,
    });
  } catch (error) {
    console.error("sourcing-notify error:", error);
    return json(500, { error: "Failed to send sourcing notification" });
  }
});
