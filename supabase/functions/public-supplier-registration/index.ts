import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
          error: 'A supplier with similar information already exists',
          duplicates 
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

    // TODO: Send email verification (implement with Resend)
    // const verificationToken = crypto.randomUUID();
    // await sendVerificationEmail(supplier_data.email, verificationToken);

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
