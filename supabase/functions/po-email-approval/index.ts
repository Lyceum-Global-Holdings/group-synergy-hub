// Emailed purchase-order approvals.
//
//   send_email        a signed-in buyer asks a named approver to approve by email
//   preview           the approval page loads the PO behind a token (no sign-in needed)
//   process_approval  the approver approves or rejects from the page
//
// Who may approve is decided in the database (apply_po_decision /
// po_approval_block_reason_for), the same rule the in-app buttons use.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { appUrl, emailLayout, escapeHtml, sendEmail } from "../_shared/email.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Level = 'merchandiser' | 'department_head';
const levelLabel = (level: string) => (level === 'merchandiser' ? 'Merchandiser' : 'Department Head');

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();

    if (body.action === 'send_email') return await handleSendEmail(req, body, supabase);
    if (body.action === 'preview') return await handlePreview(body, supabase);
    if (body.action === 'process_approval') return await handleProcessApproval(body, supabase);
    return json({ error: 'Invalid action' }, 400);
  } catch (error) {
    console.error('Error in po-email-approval:', error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

async function handleSendEmail(req: Request, data: { po_id: string; approver_email: string; approval_level: Level }, supabase: any) {
  // The caller must be signed in and belong to the PO's company.
  const authHeader = req.headers.get('Authorization') ?? '';
  const { data: userData } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  const callerId = userData?.user?.id;
  if (!callerId) return json({ error: 'Unauthorized' }, 401);

  const { po_id, approval_level } = data;
  const approverEmail = String(data.approver_email ?? '').trim().toLowerCase();
  if (!po_id || !approverEmail || !['merchandiser', 'department_head'].includes(approval_level)) {
    return json({ error: 'Choose the purchase order, the approver and the approval level' }, 400);
  }

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('*, supplier:suppliers(name), items:po_items(item_name, quantity_ordered, unit_of_measure, unit_price, total_price)')
    .eq('id', po_id)
    .maybeSingle();
  if (!po) return json({ error: 'Purchase order not found' }, 404);

  const { data: callerInCompany } = await supabase.rpc('user_in_company', { p_user: callerId, p_company_id: po.company_id });
  const { data: callerIsAdmin } = await supabase.rpc('is_admin', { _user_id: callerId });
  if (!callerInCompany && !callerIsAdmin) return json({ error: 'Forbidden' }, 403);

  // The approver must be a user who can approve this PO at this stage.
  const { data: approver } = await supabase
    .from('profiles')
    .select('user_id, full_name, email')
    .ilike('email', approverEmail)
    .maybeSingle();
  if (!approver?.user_id) {
    return json({ error: `No user with the email ${approverEmail}. Approvers must have an ERP account.` }, 400);
  }
  const { data: reason } = await supabase.rpc('po_approval_block_reason_for', {
    p_user: approver.user_id, p_po_id: po_id, p_level: approval_level,
  });
  if (reason) {
    return json({ error: `${approver.full_name || approverEmail} can't approve this purchase order: ${reason}` }, 400);
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const { error: tokenError } = await supabase.from('po_approval_tokens').insert({
    po_id,
    token,
    approver_id: approver.user_id,
    approver_email: approverEmail,
    approval_level,
    expires_at: expiresAt.toISOString(),
  });
  if (tokenError) {
    console.error('Token creation error:', tokenError);
    return json({ error: 'Failed to create the approval link' }, 500);
  }

  const money = (n: unknown) => `${escapeHtml(po.currency ?? 'LKR')} ${Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const rows = (po.items ?? []).map((item: any) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eef1f5">${escapeHtml(item.item_name)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eef1f5;text-align:right">${escapeHtml(item.quantity_ordered)} ${escapeHtml(item.unit_of_measure ?? '')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eef1f5;text-align:right">${money(item.unit_price)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eef1f5;text-align:right">${money(item.total_price)}</td>
    </tr>`).join('');

  const html = emailLayout({
    heading: `Purchase order ${po.po_number} needs your approval`,
    body: `
      <p>You're asked to approve this purchase order as <strong>${levelLabel(approval_level)}</strong>.</p>
      <p><strong>Supplier:</strong> ${escapeHtml(po.supplier?.name ?? '—')}<br>
         <strong>PO date:</strong> ${escapeHtml(po.po_date ?? '—')}<br>
         <strong>Expected delivery:</strong> ${escapeHtml(po.expected_delivery_date ?? '—')}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="text-align:left;color:#6b7686">
          <th style="padding:6px 8px">Item</th><th style="padding:6px 8px;text-align:right">Qty</th>
          <th style="padding:6px 8px;text-align:right">Unit price</th><th style="padding:6px 8px;text-align:right">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:16px"><strong>Total: ${money(po.final_amount ?? po.total_amount)}</strong></p>
      ${po.notes ? `<p><strong>Notes:</strong> ${escapeHtml(po.notes)}</p>` : ''}`,
    action: { label: 'Review and decide', url: `${appUrl(req)}/procurement/po-email-approval?token=${token}` },
    footer: 'The link works once and expires in 7 days. If you weren\'t expecting this, ignore it.',
  });

  const sent = await sendEmail({
    to: approverEmail,
    subject: `Approval needed: ${po.po_number} (${levelLabel(approval_level)})`,
    html,
  });
  if (!sent.sent) {
    await supabase.from('po_approval_tokens').delete().eq('token', token);
    console.error('Email send error:', sent.error);
    return json({ error: `The email couldn't be sent: ${sent.error}` }, 502);
  }

  console.log(`Approval email sent to ${approverEmail} for PO ${po.po_number} (${approval_level}) by ${callerId}`);
  // The token is deliberately not returned: only the approver's mailbox gets it.
  return json({ success: true, message: `Approval email sent to ${approver.full_name || approverEmail}` });
}

async function loadToken(token: unknown, supabase: any) {
  if (typeof token !== 'string' || !token) throw new Error('Invalid approval link');
  const { data } = await supabase.from('po_approval_tokens').select('*').eq('token', token).maybeSingle();
  if (!data) throw new Error('This approval link is not valid');
  if (data.used) throw new Error('This approval link has already been used');
  if (new Date(data.expires_at) < new Date()) throw new Error('This approval link has expired');
  return data;
}

async function handlePreview(data: { token: string }, supabase: any) {
  let tokenRow;
  try {
    tokenRow = await loadToken(data.token, supabase);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('po_number, po_date, expected_delivery_date, currency, total_amount, final_amount, notes, status, supplier:suppliers(name), items:po_items(item_name, quantity_ordered, unit_of_measure, unit_price, total_price)')
    .eq('id', tokenRow.po_id)
    .maybeSingle();
  if (!po) return json({ error: 'Purchase order not found' }, 404);

  const { data: reason } = await supabase.rpc('po_approval_block_reason_for', {
    p_user: tokenRow.approver_id, p_po_id: tokenRow.po_id, p_level: tokenRow.approval_level,
  });
  return json({
    approval_level: tokenRow.approval_level,
    approver_email: tokenRow.approver_email,
    expires_at: tokenRow.expires_at,
    blocked_reason: reason ?? null,
    po,
  });
}

async function handleProcessApproval(data: { token: string; approval_action: 'approve' | 'reject'; comments?: string }, supabase: any) {
  let tokenRow;
  try {
    tokenRow = await loadToken(data.token, supabase);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
  if (!['approve', 'reject'].includes(data.approval_action)) return json({ error: 'Choose approve or reject' }, 400);

  // Same checks and effects as the in-app approval: rights at this level, not
  // the PO's creator, not both levels by one person, within any amount limit.
  const { data: newStatus, error } = await supabase.rpc('apply_po_decision', {
    p_user: tokenRow.approver_id,
    p_po_id: tokenRow.po_id,
    p_approve: data.approval_action === 'approve',
    p_comments: data.comments ?? null,
    p_method: 'email',
    p_level: tokenRow.approval_level,
  });
  if (error) {
    console.error(`PO email decision refused for token ${String(data.token).slice(0, 8)}…: ${error.message}`);
    return json({ error: error.message }, 400);
  }

  await supabase.from('po_approval_tokens').update({ used: true, used_at: new Date().toISOString() }).eq('id', tokenRow.id);
  console.log(`PO ${tokenRow.po_id} ${data.approval_action} by ${tokenRow.approver_id} (${tokenRow.approval_level}) via email → ${newStatus}`);

  return json({
    success: true,
    status: newStatus,
    message: data.approval_action === 'approve' ? 'Purchase order approved' : 'Purchase order rejected',
    next_step: newStatus === 'pending_dept_head_approval' ? 'It now waits for department head approval.'
      : newStatus === 'approved' ? 'It is fully approved and can be sent to the supplier.' : '',
  });
}
