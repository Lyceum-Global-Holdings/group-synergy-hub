import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appUrl = Deno.env.get('APP_URL') || 'https://97371e45-ba68-475a-8e58-140dc43c3510.lovableproject.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendApprovalEmailRequest {
  action: 'send_email';
  po_id: string;
  approver_email: string;
  approver_id?: string;
  approval_level: 'merchandiser' | 'department_head';
}

interface ProcessApprovalRequest {
  action: 'process_approval';
  token: string;
  approval_action: 'approve' | 'reject';
  comments?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();

    if (body.action === 'send_email') {
      // SECURITY: Require authenticated caller. Without this, any actor could
      // trigger PO approval emails to arbitrary addresses and leak PO details.
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // SECURITY: Verify caller belongs to the same company as the PO before
      // sending the email (prevents cross-tenant PO data leakage via email).
      const callerId = userData.user.id;
      const { data: poRow, error: poLookupError } = await supabase
        .from('purchase_orders')
        .select('company_id')
        .eq('id', body.po_id)
        .single();

      if (poLookupError || !poRow) {
        return new Response(JSON.stringify({ error: 'Purchase order not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: callerId });
      if (!isAdmin) {
        const { data: callerCompanies } = await supabase
          .from('user_companies')
          .select('company_id')
          .eq('user_id', callerId);
        const callerCompanyIds = (callerCompanies ?? []).map((c: any) => c.company_id);
        if (!callerCompanyIds.includes(poRow.company_id)) {
          console.error(`Security: User ${callerId} attempted to send PO approval email for PO from another company`);
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return await handleSendEmail(body, supabase);
    } else if (body.action === 'process_approval') {
      return await handleProcessApproval(body, supabase);
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in po-email-approval:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function handleSendEmail(data: SendApprovalEmailRequest, supabase: any) {
  let { approver_id } = data;
  const { po_id, approver_email, approval_level } = data;

  // If approver_id not provided, look up user by email
  if (!approver_id) {
    const { data: userData } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', approver_email)
      .maybeSingle();

    if (userData) {
      approver_id = userData.user_id;
    }
    // If no user found, continue without approver_id
    // Token will be created but approval requires authentication
  }

  // Fetch PO details
  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      supplier:suppliers(name),
      items:po_items(item_name, quantity_ordered, unit_price, total_price)
    `)
    .eq('id', po_id)
    .single();

  if (poError || !po) {
    throw new Error('Purchase order not found');
  }

  // Generate approval token
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  // Store token
  const { error: tokenError } = await supabase
    .from('po_approval_tokens')
    .insert({
      po_id,
      token,
      approver_id: approver_id || null,
      approver_email,
      approval_level,
      expires_at: expiresAt.toISOString(),
    });

  if (tokenError) {
    console.error('Token creation error:', tokenError);
    throw new Error('Failed to create approval token');
  }

  // Create email content
  const approveUrl = `${appUrl}/procurement/po-email-approval?token=${token}&action=approve`;
  const rejectUrl = `${appUrl}/procurement/po-email-approval?token=${token}&action=reject`;

  const itemsHtml = po.items.map((item: any) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.item_name}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity_ordered}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${po.currency} ${item.unit_price.toFixed(2)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${po.currency} ${item.total_price.toFixed(2)}</td>
    </tr>
  `).join('');

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .button { display: inline-block; padding: 12px 24px; margin: 10px 5px; text-decoration: none; border-radius: 4px; font-weight: bold; }
        .approve-btn { background-color: #10b981; color: white; }
        .reject-btn { background-color: #ef4444; color: white; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background-color: #e5e7eb; padding: 12px; text-align: left; border: 1px solid #ddd; }
        td { padding: 8px; border: 1px solid #ddd; }
        .total { font-weight: bold; font-size: 18px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Purchase Order Approval Required</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>A purchase order requires your approval as <strong>${approval_level === 'merchandiser' ? 'Merchandiser' : 'Department Head'}</strong>.</p>
          
          <h2>Purchase Order Details</h2>
          <p><strong>PO Number:</strong> ${po.po_number}</p>
          <p><strong>Supplier:</strong> ${po.supplier?.name || 'N/A'}</p>
          <p><strong>PO Date:</strong> ${new Date(po.po_date).toLocaleDateString()}</p>
          <p><strong>Expected Delivery:</strong> ${po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : 'N/A'}</p>
          
          <h3>Line Items</h3>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <p class="total">Total Amount: ${po.currency} ${po.final_amount.toFixed(2)}</p>
          
          ${po.notes ? `<p><strong>Notes:</strong> ${po.notes}</p>` : ''}
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${approveUrl}" class="button approve-btn">Approve PO</a>
            <a href="${rejectUrl}" class="button reject-btn">Reject PO</a>
          </div>
          
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            This link will expire in 7 days. If you didn't expect this email, please ignore it.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Send email
  const { error: emailError } = await resend.emails.send({
    from: 'Purchase Orders <onboarding@resend.dev>',
    to: [approver_email],
    subject: `PO Approval Required: ${po.po_number} - ${approval_level === 'merchandiser' ? 'Merchandiser' : 'Department Head'} Review`,
    html: emailHtml,
  });

  if (emailError) {
    console.error('Email send error:', emailError);
    throw new Error('Failed to send approval email');
  }

  console.log(`Approval email sent to ${approver_email} for PO ${po.po_number}`);

  return new Response(JSON.stringify({ 
    success: true,
    message: 'Approval email sent successfully',
    token 
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleProcessApproval(data: ProcessApprovalRequest, supabase: any) {
  const { token, approval_action, comments } = data;

  // Validate token
  const { data: tokenData, error: tokenError } = await supabase
    .from('po_approval_tokens')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .single();

  if (tokenError || !tokenData) {
    console.error(`Invalid token attempt: ${token?.substring(0, 8)}...`);
    throw new Error('Invalid or expired approval token');
  }

  // Check expiry
  if (new Date(tokenData.expires_at) < new Date()) {
    console.error(`Expired token attempt: ${token.substring(0, 8)}...`);
    throw new Error('Approval token has expired');
  }

  const { approval_level, po_id, approver_id, approver_email } = tokenData;

  // SECURITY: Fetch PO to get company_id and amount for authorization check
  const { data: poData, error: poError } = await supabase
    .from('purchase_orders')
    .select('company_id, final_amount, po_number')
    .eq('id', po_id)
    .single();

  if (poError || !poData) {
    throw new Error('Purchase order not found');
  }

  // SECURITY: Verify approver_id is required - cannot process without knowing who is approving
  if (!approver_id) {
    console.error(`Security: Approval attempt without approver_id for PO ${po_id}`);
    throw new Error('Approver identification required. Please log in to approve this PO.');
  }

  // SECURITY: Verify the approver belongs to the same company as the PO
  const { data: approverCompanies, error: companyError } = await supabase
    .from('user_companies')
    .select('company_id')
    .eq('user_id', approver_id);

  if (companyError || !approverCompanies || approverCompanies.length === 0) {
    console.error(`Security: Approver ${approver_id} has no company associations`);
    throw new Error('You do not have permission to approve this purchase order');
  }

  const approverCompanyIds = approverCompanies.map((c: any) => c.company_id);
  if (!approverCompanyIds.includes(poData.company_id)) {
    console.error(`Security violation: Approver ${approver_id} attempted to approve PO from different company. Approver companies: ${approverCompanyIds.join(',')}, PO company: ${poData.company_id}`);
    throw new Error('You do not have permission to approve this purchase order');
  }

  // SECURITY: Map token approval_level to company_approvers approval_level
  const approverLevelMap: Record<string, string[]> = {
    'merchandiser': ['procurement', 'manager', 'custom'],
    'department_head': ['hod', 'manager', 'finance']
  };
  const allowedLevels = approverLevelMap[approval_level] || [];

  // SECURITY: Verify the approver is registered as an approver with appropriate level
  const { data: approverAuth, error: approverAuthError } = await supabase
    .from('company_approvers')
    .select('id, approval_level, can_approve_up_to_amount, is_active')
    .eq('user_id', approver_id)
    .eq('company_id', poData.company_id)
    .in('approval_level', allowedLevels)
    .maybeSingle();

  // SECURITY: Also check if user is an admin (admins can always approve)
  const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: approver_id });

  if (!isAdmin && !approverAuth) {
    console.error(`Security: User ${approver_id} is not authorized as approver for level ${approval_level} in company ${poData.company_id}`);
    throw new Error(`You are not authorized to approve purchase orders at the ${approval_level} level. Please contact your administrator.`);
  }

  // SECURITY: Check if the approver entry is active (if not admin)
  if (!isAdmin && approverAuth && approverAuth.is_active === false) {
    console.error(`Security: Approver ${approver_id} is inactive`);
    throw new Error('Your approver status is currently inactive. Please contact your administrator.');
  }

  // SECURITY: Verify the PO amount is within the approver's limit (if not admin)
  if (!isAdmin && approverAuth?.can_approve_up_to_amount !== null && approverAuth?.can_approve_up_to_amount !== undefined) {
    const poAmount = parseFloat(poData.final_amount) || 0;
    const approverLimit = parseFloat(approverAuth.can_approve_up_to_amount) || 0;
    
    if (poAmount > approverLimit) {
      console.error(`Security: Approver ${approver_id} attempted to approve PO ${po_id} (${poAmount}) exceeding their limit (${approverLimit})`);
      throw new Error(`This purchase order amount exceeds your approval limit. Amount: ${poAmount.toFixed(2)}, Your limit: ${approverLimit.toFixed(2)}`);
    }
  }

  // AUDIT: Log the approval attempt
  console.log(`PO Approval AUTHORIZED: token=${token.substring(0, 8)}..., approver_id=${approver_id}, approver_email=${approver_email}, action=${approval_action}, po_id=${po_id}, po_number=${poData.po_number}, amount=${poData.final_amount}, is_admin=${isAdmin}`);

  // Mark token as used
  await supabase
    .from('po_approval_tokens')
    .update({ used: true, used_at: new Date().toISOString() })
    .eq('id', tokenData.id);

  if (approval_action === 'approve') {
    // Update PO with approval
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (approval_level === 'merchandiser') {
      updateData.merchandiser_approved_by = approver_id;
      updateData.merchandiser_approved_date = new Date().toISOString();
      updateData.merchandiser_comments = comments || null;
      updateData.approval_level = 1;
      updateData.status = 'pending_dept_head_approval';
    } else if (approval_level === 'department_head') {
      updateData.department_head_approved_by = approver_id;
      updateData.department_head_approved_date = new Date().toISOString();
      updateData.department_head_comments = comments || null;
      updateData.approval_level = 2;
      updateData.status = 'approved';
      updateData.approved_by = approver_id;
      updateData.approved_date = new Date().toISOString();
    }

    await supabase
      .from('purchase_orders')
      .update(updateData)
      .eq('id', po_id);

    // Create approval record with audit info
    await supabase
      .from('po_approvals')
      .insert({
        po_id,
        approver_id,
        action: 'approved',
        comments: comments || null,
        approval_level,
        approval_method: 'email',
      });

    console.log(`PO ${poData.po_number} approved by ${approver_id} at level ${approval_level}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `PO ${approval_action === 'approve' ? 'approved' : 'rejected'} successfully`,
      next_step: approval_level === 'merchandiser' ? 'Pending Department Head approval' : 'Fully approved'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } else {
    // Rejection
    await supabase
      .from('purchase_orders')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString()
      })
      .eq('id', po_id);

    await supabase
      .from('po_approvals')
      .insert({
        po_id,
        approver_id,
        action: 'rejected',
        comments: comments || `Rejected by ${approval_level}`,
        approval_level,
        approval_method: 'email',
      });

    console.log(`PO ${poData.po_number} rejected by ${approver_id} at level ${approval_level}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'PO rejected successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
