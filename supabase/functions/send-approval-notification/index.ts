import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") || "http://localhost:8080";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  approver_email: string;
  approver_name: string;
  supplier_name: string;
  registration_id: string;
  stage_name: string;
  notification_type: 'assigned' | 'escalated' | 'completed';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      approver_email,
      approver_name,
      supplier_name,
      registration_id,
      stage_name,
      notification_type,
    }: NotificationRequest = await req.json();

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const approvalUrl = `${APP_URL}/sourcing/supplier-registration?review=${registration_id}`;

    let subject = '';
    let message = '';

    switch (notification_type) {
      case 'assigned':
        subject = `Action Required: Supplier Registration - ${supplier_name}`;
        message = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Supplier Registration Approval Needed</h2>
            <p>Hello ${approver_name},</p>
            <p>A new supplier registration requires your approval:</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Supplier:</strong> ${supplier_name}</p>
              <p style="margin: 5px 0;"><strong>Stage:</strong> ${stage_name}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> Pending Your Review</p>
            </div>
            <p>Please review and approve or reject this supplier registration at your earliest convenience.</p>
            <div style="margin: 30px 0;">
              <a href="${approvalUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Review Registration
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">This is an automated notification from your Procurement System.</p>
          </div>
        `;
        break;
      case 'escalated':
        subject = `Escalated: Supplier Registration - ${supplier_name}`;
        message = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Escalated Supplier Registration</h2>
            <p>Hello ${approver_name},</p>
            <p>A supplier registration has been escalated to you due to delayed approval:</p>
            <div style="background-color: #fef2f2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <p style="margin: 5px 0;"><strong>Supplier:</strong> ${supplier_name}</p>
              <p style="margin: 5px 0;"><strong>Stage:</strong> ${stage_name}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> Escalated - Urgent Action Required</p>
            </div>
            <p>This registration requires immediate attention. Please review and take action as soon as possible.</p>
            <div style="margin: 30px 0;">
              <a href="${approvalUrl}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Review Urgent Registration
              </a>
            </div>
          </div>
        `;
        break;
      case 'completed':
        subject = `Completed: Supplier Registration - ${supplier_name}`;
        message = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Supplier Registration Completed</h2>
            <p>Hello ${approver_name},</p>
            <p>The following supplier registration has been successfully completed:</p>
            <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #16a34a;">
              <p style="margin: 5px 0;"><strong>Supplier:</strong> ${supplier_name}</p>
              <p style="margin: 5px 0;"><strong>Stage:</strong> ${stage_name}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> Approved</p>
            </div>
            <p>The supplier has been added to your supplier master and is now available for procurement activities.</p>
          </div>
        `;
        break;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Procurement System <notifications@resend.dev>",
        to: [approver_email],
        subject: subject,
        html: message,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    const data = await res.json();

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
