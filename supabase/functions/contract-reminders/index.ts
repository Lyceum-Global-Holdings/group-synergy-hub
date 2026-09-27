// Contract emails. Runs each morning after the nightly contract job (pg_cron):
// every contract event not yet emailed (coming up for renewal, renewed
// automatically, expired) goes to the contract's owner and creator, one digest
// per person. Only unsent events are touched, so calling it again is harmless.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { appUrl, emailLayout, escapeHtml, sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SECTIONS = [
  { event: "renewal_due", heading: "Coming up for renewal" },
  { event: "auto_renewed", heading: "Renewed automatically" },
  { event: "expired", heading: "Expired" },
] as const;

const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";

interface ContractEvent {
  id: string;
  event: string;
  old_expiry: string | null;
  new_expiry: string | null;
  note: string | null;
  contract: {
    id: string;
    contract_number: string;
    contract_title: string;
    counterparty_name: string | null;
    owner_id: string | null;
    created_by: string | null;
  } | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await admin
      .from("contract_events")
      .select("id, event, old_expiry, new_expiry, note, contract:contracts(id, contract_number, contract_title, counterparty_name, owner_id, created_by)")
      .is("emailed_at", null)
      .in("event", SECTIONS.map((s) => s.event))
      .gte("created_at", since)
      .order("created_at")
      .limit(500);
    if (error) throw error;
    const events = (data ?? []) as unknown as ContractEvent[];
    if (events.length === 0) return json(200, { success: true, emails: 0, events: 0 });

    // Who hears about each event: the contract's owner and whoever created it.
    const userIds = [...new Set(events.flatMap((e) => [e.contract?.owner_id, e.contract?.created_by]).filter(Boolean))] as string[];
    const { data: people } = await admin
      .from("profiles")
      .select("user_id, email, full_name, deactivated_at")
      .in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const personById = new Map((people ?? []).filter((p) => p.email && !p.deactivated_at).map((p) => [p.user_id, p]));

    const byEmail = new Map<string, { name: string | null; events: ContractEvent[] }>();
    const noRecipient: string[] = [];
    for (const e of events) {
      const recipients = [e.contract?.owner_id, e.contract?.created_by]
        .map((id) => (id ? personById.get(id) : undefined))
        .filter(Boolean) as { email: string; full_name: string | null }[];
      if (recipients.length === 0) noRecipient.push(e.id);
      for (const p of recipients) {
        const key = p.email.toLowerCase();
        const entry = byEmail.get(key) ?? { name: p.full_name, events: [] };
        if (!entry.events.some((x) => x.id === e.id)) entry.events.push(e);
        byEmail.set(key, entry);
      }
    }

    const base = appUrl(req);
    const failedEvents = new Set<string>();
    let sent = 0;
    for (const [email, { name, events: mine }] of byEmail) {
      const sections = SECTIONS.map(({ event, heading }) => {
        const rows = mine.filter((e) => e.event === event);
        if (rows.length === 0) return "";
        const items = rows.map((e) => {
          const c = e.contract!;
          const when = e.event === "auto_renewed"
            ? `now runs to ${fmtDate(e.new_expiry)}`
            : e.event === "expired" ? `ended ${fmtDate(e.old_expiry)}` : `expires ${fmtDate(e.old_expiry)}`;
          return `<li style="margin-bottom:8px"><b>${escapeHtml(c.contract_number)}</b> · ${escapeHtml(c.contract_title)}${
            c.counterparty_name ? ` with ${escapeHtml(c.counterparty_name)}` : ""
          } — ${escapeHtml(when)}${e.note ? `<br><span style="color:#6b7686">${escapeHtml(e.note)}</span>` : ""}</li>`;
        }).join("");
        return `<h2 style="font-size:16px;margin:20px 0 8px">${heading}</h2><ul style="padding-left:20px;margin:0">${items}</ul>`;
      }).join("");

      const count = mine.length;
      const result = await sendEmail({
        to: email,
        subject: count === 1
          ? `Contract ${mine[0].contract!.contract_number}: ${SECTIONS.find((s) => s.event === mine[0].event)!.heading.toLowerCase()}`
          : `${count} contracts need your attention`,
        html: emailLayout({
          heading: "Your contracts",
          body: `<p>Hello${name ? ` ${escapeHtml(name.split(" ")[0])}` : ""},</p><p>Here is what changed with the contracts you own.</p>${sections}`,
          action: { label: "Open contracts", url: `${base}/sourcing/contracts` },
        }),
      });
      if (result.sent) sent += 1;
      else {
        console.error("contract-reminders: send failed", email, result.error);
        mine.forEach((e) => failedEvents.add(e.id));
      }
    }

    // Mark what went out (and events nobody can be told about) so they aren't repeated.
    const done = events.map((e) => e.id).filter((id) => !failedEvents.has(id));
    if (done.length) {
      const { error: markErr } = await admin.from("contract_events").update({ emailed_at: new Date().toISOString() }).in("id", done);
      if (markErr) throw markErr;
    }

    return json(200, { success: true, emails: sent, events: done.length, failed: failedEvents.size, without_recipient: noRecipient.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("contract-reminders error", message);
    return json(500, { success: false, error: message });
  }
});
