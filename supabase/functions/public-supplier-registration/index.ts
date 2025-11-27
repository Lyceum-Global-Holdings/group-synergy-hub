import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { Resend } from 'npm:resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supplier_data } = await req.json();

    // Initialize Supabase client with service role for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Basic validation
    if (!supplier_data.supplier_name || !supplier_data.email || !supplier_data.phone) {
      throw new Error('Missing required fields');
    }

    // Check for duplicates
    const { data: duplicates, error: dupError } = await supabaseAdmin.rpc('check_duplicate_supplier', {
      p_supplier_name: supplier_data.supplier_name,
      p_email: supplier_data.email,
      p_phone: supplier_data.phone,
      p_tax_id: supplier_data.tax_id || null,
    });

    if (dupError) {
      console.error('Duplicate check error:', dupError);
    }

    if (duplicates && duplicates.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'A supplier with similar information already exists. Please contact support if you believe this is an error.'
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create registration request
    const { data: registration, error: regError } = await supabaseAdmin
      .from('supplier_registration_requests')
      .insert({
        request_type: 'self_service',
        status: 'pending_approval',
        supplier_data: supplier_data,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (regError) throw regError;

    // Create initial workflow entry
    await supabaseAdmin
      .from('supplier_approval_workflow')
      .insert({
        registration_request_id: registration.id,
        stage: 'submitted',
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes: 'Public self-service registration submitted',
      });

    console.log('Registration created:', registration.id);

    // Send email confirmation
    try {
      await resend.emails.send({
        from: 'Supplier Registration <onboarding@resend.dev>',
        to: [supplier_data.email],
        subject: 'Supplier Registration Received',
        html: `
          <h1>Thank you for registering!</h1>
          <p>Dear ${supplier_data.supplier_name},</p>
          <p>We have successfully received your supplier registration request.</p>
          <p><strong>Registration ID:</strong> ${registration.id}</p>
          <p>Our team will review your application and contact you within 2-3 business days.</p>
          <p>If you have any questions, please don't hesitate to reach out.</p>
          <br>
          <p>Best regards,<br>The Procurement Team</p>
        `,
      });
      console.log('Confirmation email sent to:', supplier_data.email);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // Don't fail the registration if email fails
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        registration_id: registration.id,
        message: 'Registration submitted successfully' 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Registration error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
