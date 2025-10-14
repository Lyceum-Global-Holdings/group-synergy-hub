import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@4.0.0";

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
    throw new Error('Invalid or expired approval token');
  }

  // Check expiry
  if (new Date(tokenData.expires_at) < new Date()) {
    throw new Error('Approval token has expired');
  }

  // Mark token as used
  await supabase
    .from('po_approval_tokens')
    .update({ used: true, used_at: new Date().toISOString() })
    .eq('id', tokenData.id);

  // Process approval based on level
  const { approval_level, po_id, approver_id } = tokenData;
  
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

    // Create approval record
    await supabase
      .from('po_approvals')
      .insert({
        po_id,
        approver_id,
        action: approval_action === 'approve' ? 'approved' : 'rejected',
        comments: comments || null,
        approval_level,
        approval_method: 'email',
      });

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

    return new Response(JSON.stringify({ 
      success: true,
      message: 'PO rejected successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
