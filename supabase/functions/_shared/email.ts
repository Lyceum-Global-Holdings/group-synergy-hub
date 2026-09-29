// Email through Resend.
//
// The sender comes from the EMAIL_FROM secret (default "LGH ERP <noreply@lgh.lk>").
// Its domain must be verified in Resend, otherwise Resend only delivers to the
// account owner — which is why the old resend.dev senders never reached suppliers.

export interface EmailResult {
  sent: boolean;
  error?: string;
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Where replies go, e.g. the buyer who sent a purchase order. */
  replyTo?: string;
}): Promise<EmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY is not set" };

  const to = (Array.isArray(opts.to) ? opts.to : [opts.to]).map((a) => a.trim()).filter(Boolean);
  if (to.length === 0) return { sent: false, error: "No recipient" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM") || "LGH ERP <noreply@lgh.lk>",
        to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    if (!res.ok) return { sent: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Base URL for links in emails: APP_URL secret, else the caller's origin. */
export function appUrl(req: Request): string {
  return (Deno.env.get("APP_URL") || req.headers.get("origin") || "https://stores.lgh.lk").replace(/\/+$/, "");
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain, readable layout that works in every mail client. Body is trusted HTML. */
export function emailLayout(opts: { heading: string; body: string; action?: { label: string; url: string }; footer?: string }): string {
  const button = opts.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(opts.action.url)}" style="background:#0661d0;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">${escapeHtml(opts.action.label)}</a></p>
       <p style="font-size:12px;color:#6b7686">If the button doesn't work, copy this link into your browser:<br><span style="word-break:break-all">${escapeHtml(opts.action.url)}</span></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f6fa;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#131a24">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dfe4ec;border-radius:12px;padding:28px">
    <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(opts.heading)}</h1>
    <div style="font-size:15px;line-height:1.6">${opts.body}</div>
    ${button}
    <p style="font-size:12px;color:#6b7686;margin-top:28px">${escapeHtml(opts.footer ?? "Sent by the LGH ERP. This mailbox is not monitored.")}</p>
  </div></body></html>`;
}
