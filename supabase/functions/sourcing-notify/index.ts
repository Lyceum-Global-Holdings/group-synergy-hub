// Sourcing emails:
//   { event: "registration_decision", registration_id } → the applicant hears
//     that their supplier registration was approved or rejected (with reason);
//   { event: "rfq_published", request_id } → every invited supplier (its email
//     and its portal users) gets the RFQ with a link to quote in the portal;
//   { event: "po_sent", po_id } → the supplier (its email and primary contact)
//     gets the purchase order, with replies going to the buyer who sent it.
// The caller must be able to manage that company's sourcing.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { appUrl, emailLayout, escapeHtml, sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json(401, { success: false, error: "Sign in first." });

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const body = await req.json().catch(() => ({}));
    const base = appUrl(req);

    // Checks run as the caller, so they see the caller's company access.
    const canManageCompany = async (companyId: string | null) => {
      if (!companyId) return false;
      const [{ data: company }, { data: procurement }, { data: isAdmin }] = await Promise.all([
        userClient.rpc("can_access_company", { target_company_id: companyId }),
        userClient.rpc("has_procurement_access", { _user_id: user.id }),
        userClient.rpc("is_admin", { _user_id: user.id }),
      ]);
      return company === true && (procurement === true || isAdmin === true);
    };

    const companyName = async (companyId: string | null) => {
      if (!companyId) return "our company";
      const { data } = await admin.from("companies").select("name").eq("id", companyId).maybeSingle();
      return data?.name ?? "our company";
    };

    if (body?.event === "registration_decision") {
      const { data: reg } = await admin
        .from("supplier_registration_requests")
        .select("id, company_id, status, rejection_reason, supplier_data")
        .eq("id", body.registration_id)
        .maybeSingle();
      if (!reg) return json(404, { success: false, error: "Registration not found" });
      if (!(await canManageCompany(reg.company_id))) return json(403, { success: false, error: "Not allowed" });
      if (reg.status !== "approved" && reg.status !== "rejected") {
        return json(400, { success: false, error: "The registration has no decision yet" });
      }

      const data = (reg.supplier_data ?? {}) as Record<string, string | undefined>;
      const to = data.email || data.primary_contact_email;
      if (!to) return json(200, { success: true, sent: 0, skipped: "No email address on the registration" });

      const company = await companyName(reg.company_id);
      const supplierName = data.supplier_name || data.name || "your company";
      const approved = reg.status === "approved";
      const result = await sendEmail({
        to,
        subject: approved
          ? `Your supplier registration with ${company} is approved`
          : `Your supplier registration with ${company}`,
        html: emailLayout({
          heading: approved ? "Registration approved" : "Registration not approved",
          body: approved
            ? `<p>${escapeHtml(company)} has approved <b>${escapeHtml(supplierName)}</b> as a supplier. You can now receive requests for quotation and purchase orders.</p>
               <p>To use the supplier portal, ask your contact at ${escapeHtml(company)} for a portal invitation.</p>`
            : `<p>${escapeHtml(company)} has not approved the supplier registration for <b>${escapeHtml(supplierName)}</b>.</p>
               ${reg.rejection_reason ? `<p><b>Reason:</b> ${escapeHtml(reg.rejection_reason)}</p>` : ""}
               <p>If you think this is a mistake, contact ${escapeHtml(company)} directly.</p>`,
        }),
      });
      if (!result.sent) console.warn("registration_decision email not sent:", result.error);
      return json(200, { success: true, sent: result.sent ? 1 : 0, error: result.error });
    }

    if (body?.event === "rfq_published") {
      const { data: rfq } = await admin
        .from("rfq_rfp_requests")
        .select("id, company_id, request_number, title, submission_deadline, status")
        .eq("id", body.request_id)
        .maybeSingle();
      if (!rfq) return json(404, { success: false, error: "RFQ not found" });
      if (!(await canManageCompany(rfq.company_id))) return json(403, { success: false, error: "Not allowed" });

      const [{ data: invited }, { count: itemCount }] = await Promise.all([
        admin.from("rfq_rfp_invited_suppliers").select("supplier_id, supplier:suppliers(name, email)").eq("request_id", rfq.id),
        admin.from("rfq_rfp_items").select("id", { count: "exact", head: true }).eq("request_id", rfq.id),
      ]);

      const company = await companyName(rfq.company_id);
      const deadline = rfq.submission_deadline
        ? new Date(rfq.submission_deadline).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" })
        : "the deadline in the portal";
      const link = `${base}/portal/quotes`;

      let sent = 0;
      const failed: string[] = [];
      for (const inv of invited ?? []) {
        const supplier = inv.supplier as { name?: string; email?: string } | null;
        // The supplier's own address plus its active portal users.
        const { data: members } = await admin
          .from("supplier_users")
          .select("user_id")
          .eq("supplier_id", inv.supplier_id)
          .eq("is_active", true);
        const recipients = new Set<string>();
        if (supplier?.email) recipients.add(supplier.email.toLowerCase());
        for (const m of members ?? []) {
          const { data } = await admin.auth.admin.getUserById(m.user_id);
          if (data?.user?.email) recipients.add(data.user.email.toLowerCase());
        }
        if (recipients.size === 0) {
          failed.push(`${supplier?.name ?? inv.supplier_id}: no email address`);
          continue;
        }

        const result = await sendEmail({
          to: [...recipients],
          subject: `Request for quotation ${rfq.request_number} from ${company}`,
          html: emailLayout({
            heading: `Request for quotation: ${rfq.title}`,
            body: `<p>${escapeHtml(company)} invites <b>${escapeHtml(supplier?.name ?? "you")}</b> to quote for <b>${escapeHtml(rfq.title)}</b> (${escapeHtml(rfq.request_number)}, ${itemCount ?? 0} item${itemCount === 1 ? "" : "s"}).</p>
                   <p>Submit your prices in the supplier portal by <b>${escapeHtml(deadline)}</b> (Sri Lanka time).</p>`,
            action: { label: "Open in the supplier portal", url: link },
            footer: "You receive this because your company is a registered supplier. Portal access is by invitation from the buyer.",
          }),
        });
        if (result.sent) sent += 1;
        else failed.push(`${supplier?.name ?? inv.supplier_id}: ${result.error}`);
      }
      if (failed.length) console.warn("rfq_published emails not sent:", failed);
      return json(200, { success: true, sent, failed });
    }

    if (body?.event === "po_sent") {
      const { data: po } = await admin
        .from("purchase_orders")
        .select("id, po_number, po_date, status, company_id, supplier_id, currency, payment_terms, delivery_terms, expected_delivery_date, notes, total_amount, tax_amount, discount_amount, final_amount")
        .eq("id", body.po_id)
        .maybeSingle();
      if (!po) return json(404, { success: false, error: "Purchase order not found" });
      if (!(await canManageCompany(po.company_id))) return json(403, { success: false, error: "Not allowed" });
      if (!["sent", "acknowledged", "partially_received"].includes(po.status)) {
        return json(400, { success: false, error: "Send the purchase order before emailing it" });
      }

      const [{ data: supplier }, { data: contacts }, { data: lines }, { data: company }, { data: buyer }] = await Promise.all([
        admin.from("suppliers").select("name, email").eq("id", po.supplier_id).maybeSingle(),
        admin.from("supplier_contacts").select("email, is_primary").eq("supplier_id", po.supplier_id),
        admin.from("po_items")
          .select("item_code, item_name, description, quantity_ordered, unit_of_measure, unit_price, total_price, delivery_date")
          .eq("po_id", po.id)
          .order("created_at"),
        admin.from("companies").select("name, address").eq("id", po.company_id).maybeSingle(),
        admin.from("profiles").select("full_name, email").eq("user_id", user.id).maybeSingle(),
      ]);

      // The supplier's own address and its primary contact.
      const recipients = new Set<string>();
      if (supplier?.email) recipients.add(supplier.email.trim().toLowerCase());
      for (const c of contacts ?? []) if (c.is_primary && c.email) recipients.add(c.email.trim().toLowerCase());
      if (recipients.size === 0) {
        return json(200, { success: true, sent: 0, error: "The supplier has no email address on file" });
      }

      const currency = po.currency || "LKR";
      const money = (n: unknown) =>
        `${currency} ${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const day = (d: string | null) =>
        d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Colombo" }) : null;
      const td = "padding:6px 8px;border-bottom:1px solid #dfe4ec;vertical-align:top";
      const num = `${td};text-align:right;white-space:nowrap`;
      const small = (v: unknown) => `<br><span style="color:#6b7686;font-size:12px">${escapeHtml(v)}</span>`;
      const rows = (lines ?? []).map((l, i) => `<tr>
          <td style="${td}">${i + 1}</td>
          <td style="${td}">${escapeHtml(l.item_name)}${l.item_code ? small(l.item_code) : ""}${l.description ? small(l.description) : ""}${l.delivery_date ? small(`Deliver by ${day(l.delivery_date)}`) : ""}</td>
          <td style="${num}">${escapeHtml(Number(l.quantity_ordered).toLocaleString("en-US"))} ${escapeHtml(l.unit_of_measure)}</td>
          <td style="${num}">${money(l.unit_price)}</td>
          <td style="${num}">${money(l.total_price)}</td>
        </tr>`).join("");
      const detail = (label: string, value: unknown) =>
        value ? `<tr><td style="padding:2px 12px 2px 0;color:#6b7686">${label}</td><td>${escapeHtml(value)}</td></tr>` : "";
      const total = (label: string, value: unknown, bold = false) =>
        `<tr><td colspan="4" style="${num}${bold ? ";font-weight:700" : ""}">${label}</td><td style="${num}${bold ? ";font-weight:700" : ""}">${money(value)}</td></tr>`;
      const companyName = company?.name ?? "our company";
      const buyerName = buyer?.full_name || buyer?.email || "the procurement team";

      const result = await sendEmail({
        to: [...recipients],
        replyTo: buyer?.email ?? undefined,
        subject: `Purchase order ${po.po_number} from ${companyName}`,
        html: emailLayout({
          heading: `Purchase order ${po.po_number}`,
          body: `<p>${escapeHtml(companyName)} places the following order with <b>${escapeHtml(supplier?.name ?? "you")}</b>.</p>
                 <table style="font-size:14px;border-collapse:collapse;margin:8px 0 16px">
                   ${detail("Order date", day(po.po_date))}${detail("Deliver by", day(po.expected_delivery_date))}
                   ${detail("Payment terms", po.payment_terms)}${detail("Delivery terms", po.delivery_terms)}
                   ${detail("Deliver to", company?.address)}
                 </table>
                 <table style="width:100%;font-size:13px;border-collapse:collapse">
                   <thead><tr>
                     <th style="${td};text-align:left">#</th><th style="${td};text-align:left">Item</th>
                     <th style="${td};text-align:right">Quantity</th><th style="${td};text-align:right">Unit price</th><th style="${td};text-align:right">Amount</th>
                   </tr></thead>
                   <tbody>${rows}</tbody>
                   <tfoot>
                     ${total("Subtotal", po.total_amount)}
                     ${Number(po.discount_amount) > 0 ? total("Discount", -Number(po.discount_amount)) : ""}
                     ${Number(po.tax_amount) > 0 ? total("Tax", po.tax_amount) : ""}
                     ${total("Total", po.final_amount ?? po.total_amount, true)}
                   </tfoot>
                 </table>
                 ${po.notes ? `<p><b>Notes:</b> ${escapeHtml(po.notes)}</p>` : ""}
                 <p>Please quote <b>${escapeHtml(po.po_number)}</b> on your delivery note and invoice, and reply to confirm the order and delivery date.</p>
                 <p>${escapeHtml(buyerName)}<br>${escapeHtml(companyName)}</p>`,
          footer: `Replies go to ${buyer?.email ?? "the buyer"}. Sent by the LGH ERP on behalf of ${companyName}.`,
        }),
      });
      if (!result.sent) {
        console.warn("po_sent email not sent:", result.error);
        return json(200, { success: true, sent: 0, error: result.error });
      }
      await admin
        .from("purchase_orders")
        .update({ supplier_emailed_at: new Date().toISOString(), supplier_emailed_to: [...recipients].join(", ") })
        .eq("id", po.id);
      return json(200, { success: true, sent: 1, to: [...recipients] });
    }

    return json(400, { success: false, error: "Unknown event" });
  } catch (error) {
    console.error("sourcing-notify error:", error);
    return json(500, { success: false, error: "Could not send the notification" });
  }
});
