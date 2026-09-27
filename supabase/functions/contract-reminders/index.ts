import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") || "https://group-synergy-hub.lovable.app";
const EMAIL_FROM = "Lyceum Procurement <notifications@resend.dev>";

// Statuses eligible for expiry/renewal reminders
const REMINDABLE_STATUSES = ["approved", "active"];

const DEFAULT_DAYS_AHEAD = 30;
const MAX_DAYS_AHEAD = 365;

const DEFAULT_RECIPIENT_ROLES = ["super_admin", "admin", "manager"];
const MAX_RECIPIENTS = 10;
const MAX_CONTRACTS_PER_RUN = 200;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface ReminderBody {
  company_id?: string;
  days_ahead?: number;
  dry_run?: boolean;
}

interface ContractRow {
  id: string;
  contract_number: string;
  contract_title: string;
  counterparty_name: string | null;
  expiry_date: string;
  renewal_notice_days: number | null;
  auto_renew: boolean | null;
  renewal_count: number | null;
  max_renewal_count: number | null;
  contract_value: string | number | null;
  currency: string | null;
  company_id: string | null;
}

interface CompanyReminder {
  companyId: string;
  contracts: (ContractRow & { daysUntilExpiry: number; noticeWindow: number })[];
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

function formatMoney(value: string | number | null, currency: string | null): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "";
  const cur = currency || "LKR";
  return `${cur} ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildContractEmail(contract: ContractRow, daysUntil: number, link: string) {
  const urgent = daysUntil <= 7;
  const accent = urgent ? "#dc2626" : "#d97706";
  const urgency = daysUntil === 0
    ? "expires today"
    : daysUntil < 0
      ? `expired ${Math.abs(daysUntil)} day(s) ago`
      : `expires in ${daysUntil} day(s)`;

  const value = formatMoney(contract.contract_value, contract.currency);
  const renewNote = contract.auto_renew
    ? "This contract is set to <strong>auto-renew</strong> — review the renewal terms before the notice date."
    : "This contract does <strong>not</strong> auto-renew — a renewal decision is required.";

  return {
    subject: `[Contract Reminder] ${contract.contract_number} — ${contract.contract_title} ${urgency}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${accent}; border-left: 4px solid ${accent}; padding-left: 12px;">
          Contract ${urgency}
        </h2>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin:5px 0;"><strong>Contract:</strong> ${escapeHtml(contract.contract_number)} — ${escapeHtml(contract.contract_title)}</p>
          ${contract.counterparty_name ? `<p style="margin:5px 0;"><strong>Counterparty:</strong> ${escapeHtml(contract.counterparty_name)}</p>` : ""}
          <p style="margin:5px 0;"><strong>Expiry date:</strong> ${escapeHtml(contract.expiry_date)}</p>
          ${value ? `<p style="margin:5px 0;"><strong>Value:</strong> ${escapeHtml(value)}</p>` : ""}
          <p style="margin:5px 0;"><strong>Renewals so far:</strong> ${contract.renewal_count ?? 0}${contract.max_renewal_count ? ` / ${contract.max_renewal_count}` : ""}</p>
        </div>
        <p style="margin:15px 0;">${renewNote}</p>
        <div style="margin:30px 0;">
          <a href="${link}" style="background-color: ${accent}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Open Contract
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This is an automated reminder from your Procurement System.</p>
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Parse optional body
    let body: ReminderBody = {};
    let hasBodyParams = false;
    try {
      const raw = await req.json();
      if (raw && typeof raw === "object") {
        body = raw as ReminderBody;
        hasBodyParams = body.company_id != null || body.days_ahead != null || body.dry_run != null;
      }
    } catch {
      // Cron-triggered runs send no body
    }

    // ── Auth guard: manual/targeted runs must come from an authenticated admin ──
    if (hasBodyParams) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return json(401, { error: "Unauthorized" });
      }
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims) {
        return json(401, { error: "Unauthorized" });
      }
      const { data: isAdmin, error: roleErr } = await serviceClient.rpc("is_admin", {
        _user_id: claimsData.claims.sub as string,
      });
      if (roleErr || !isAdmin) {
        return json(403, { error: "Forbidden — admin role required for manual triggers" });
      }
    }

    // ── Options ─────────────────────────────────────────────────────────
    const companyId = typeof body.company_id === "string" && UUID_RE.test(body.company_id)
      ? body.company_id
      : null;
    const daysAhead = typeof body.days_ahead === "number" && Number.isFinite(body.days_ahead)
      ? Math.min(Math.max(Math.round(body.days_ahead), 1), MAX_DAYS_AHEAD)
      : DEFAULT_DAYS_AHEAD;
    const dryRun = body.dry_run === true;
    const today = todayIso();

    // ── Find contracts due for a reminder ───────────────────────────────
    // Reminder window per contract = renewal_notice_days (fallback: daysAhead).
    // Skip contracts already reminded within their current window.
    let query = serviceClient
      .from("contracts")
      .select(
        "id, contract_number, contract_title, counterparty_name, expiry_date, renewal_notice_days, auto_renew, renewal_count, max_renewal_count, contract_value, currency, company_id"
      )
      .in("status", REMINDABLE_STATUSES)
      .not("expiry_date", "is", null)
      .lte("expiry_date", new Date(Date.now() + MAX_DAYS_AHEAD * 86_400_000).toISOString().slice(0, 10))
      .order("expiry_date", { ascending: true })
      .limit(MAX_CONTRACTS_PER_RUN);

    if (companyId) query = query.eq("company_id", companyId);

    const { data: contracts, error: contractsError } = await query;
    if (contractsError) {
      console.error("Error fetching contracts:", contractsError);
      return json(500, { error: "Failed to fetch contracts" });
    }

    const due = new Map<string, CompanyReminder>();
    for (const c of (contracts ?? []) as ContractRow[]) {
      if (!c.company_id || !UUID_RE.test(c.company_id)) continue;
      const noticeWindow = c.renewal_notice_days && c.renewal_notice_days > 0
        ? Math.min(c.renewal_notice_days, MAX_DAYS_AHEAD)
        : daysAhead;
      const daysUntil = daysBetween(today, c.expiry_date);
      if (daysUntil > noticeWindow) continue; // not due yet

      const { data: lastSent } = await serviceClient
        .from("contracts")
        .select("renewal_notice_sent_for")
        .eq("id", c.id)
        .maybeSingle();
      if (lastSent?.renewal_notice_sent_for) {
        const windowStart = new Date(
          new Date(`${c.expiry_date}T00:00:00Z`).getTime() - noticeWindow * 86_400_000
        ).toISOString().slice(0, 10);
        if (lastSent.renewal_notice_sent_for >= windowStart) continue; // already reminded this window
      }

      const bucket = due.get(c.company_id) ?? { companyId: c.company_id, contracts: [] };
      bucket.contracts.push({ ...c, daysUntilExpiry: daysUntil, noticeWindow });
      due.set(c.company_id, bucket);
    }

    if (due.size === 0) {
      return json(200, {
        success: true,
        message: "No contracts due for reminders",
        companies_processed: 0,
        reminders_sent: 0,
      });
    }

    // ── Send per company ────────────────────────────────────────────────
    let remindersSent = 0;
    const companyResults: unknown[] = [];

    for (const reminder of due.values()) {
      const result: Record<string, unknown> = {
        company_id: reminder.companyId,
        contracts_due: reminder.contracts.length,
      };

      // Resolve recipients: active admins/managers of the company
      const { data: staff } = await serviceClient
        .from("profiles")
        .select("email")
        .eq("company_id", reminder.companyId)
        .eq("deactivated_at", "is", null)
        .in("role", DEFAULT_RECIPIENT_ROLES);

      const to = Array.from(
        new Set(
          (staff ?? [])
            .map((s: { email: string | null }) => (s.email ?? "").toLowerCase())
            .filter((e: string) => EMAIL_RE.test(e))
        )
      ).slice(0, MAX_RECIPIENTS);
      result.recipients = to;

      if (to.length === 0) {
        result.error = "No recipients resolved (no active admin/manager users)";
        companyResults.push(result);
        continue;
      }

      if (!dryRun) {
        // Email
        let emailFailed: string | null = null;
        if (RESEND_API_KEY) {
          // Group contracts into one digest email per company
          const sections = reminder.contracts.map((c) => {
            const link = `${APP_URL}/contracts`;
            const { subject: _s, html } = buildContractEmail(c, c.daysUntilExpiry, link);
            return html;
          });
          const digest = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color:#2563eb;">Contract Expiry Reminders — ${reminder.contracts.length} contract(s)</h2>
              ${sections.join('<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>')}
            </div>`;
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: EMAIL_FROM,
              to,
              subject: `[Contract Reminders] ${reminder.contracts.length} contract(s) approaching expiry`,
              html: digest,
            }),
          });
          if (!res.ok) emailFailed = (await res.text()).slice(0, 300);
        } else {
          emailFailed = "RESEND_API_KEY not configured";
        }
        result.email_sent = !emailFailed;
        if (emailFailed) result.email_error = emailFailed;

        // Telegram (optional, per company settings)
        const { data: tgSettings } = await serviceClient
          .from("telegram_settings")
          .select("bot_token, chat_id, is_enabled")
          .eq("company_id", reminder.companyId)
          .maybeSingle();

        let telegramSent = false;
        if (tgSettings?.is_enabled && tgSettings.bot_token && tgSettings.chat_id) {
          const lines = reminder.contracts.map(
            (c) =>
              `⚠️ <b>${escapeHtml(c.contract_number)}</b> — ${escapeHtml(c.contract_title)}\n` +
              `Expires: ${c.expiry_date} (${c.daysUntilExpiry <= 0 ? "OVERDUE" : `in ${c.daysUntilExpiry} day(s)`})` +
              (c.counterparty_name ? `\nCounterparty: ${escapeHtml(c.counterparty_name)}` : "")
          );
          const text = `📋 <b>Contract Reminders</b>\n\n${lines.join("\n\n")}\n\n${APP_URL}/contracts`;
          const tgRes = await fetch(
            `https://api.telegram.org/bot${tgSettings.bot_token}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: tgSettings.chat_id, text, parse_mode: "HTML" }),
            }
          );
          telegramSent = tgRes.ok;
          if (!tgRes.ok) result.telegram_error = (await tgRes.text()).slice(0, 300);
        }
        result.telegram_sent = telegramSent;

        const sent = result.email_sent === true || telegramSent;

        // Mark notices sent to prevent duplicates
        if (sent) {
          const { error: updateError } = await serviceClient
            .from("contracts")
            .update({ renewal_notice_sent_for: today })
            .in(
              "id",
              reminder.contracts.map((c) => c.id)
            );
          if (updateError) {
            result.dedup_error = updateError.message;
            console.error("Failed to mark renewal_notice_sent_for:", updateError);
          }
        }

        if (sent) {
          remindersSent += reminder.contracts.length;
          result.reminders_sent = reminder.contracts.length;
        }
      } else {
        result.dry_run = true;
      }

      companyResults.push(result);
    }

    return json(200, {
      success: true,
      companies_processed: due.size,
      reminders_sent: remindersSent,
      results: companyResults,
    });
  } catch (error) {
    console.error("contract-reminders error:", error);
    return json(500, { error: "Failed to process contract reminders" });
  }
});
