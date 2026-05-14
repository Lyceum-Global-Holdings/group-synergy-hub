import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { Resend } from 'https://esm.sh/resend@4.0.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { verifyTurnstile, getRequestIp } from "../_shared/turnstile.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_REQUESTS_PER_WINDOW = 5; // Max 5 submissions per hour per IP
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Input validation: keep core fields strict, allow any additional configured/custom fields.
const supplierDataSchema = z.object({
  supplier_name: z.string().trim().min(2, "Supplier name must be at least 2 characters").max(200, "Supplier name too long"),
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  phone: z.string().trim().min(8, "Phone number must be at least 8 characters").max(20, "Phone number too long").optional(),
  tax_id: z.string().trim().max(50, "Tax ID too long").optional(),
  website: z.string().trim().url("Invalid website URL").max(255, "Website URL too long").optional().or(z.literal('')),
}).passthrough();

// Rate limiting function
function checkRateLimit(ip: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!record || record.resetTime < now) {
    // Start new window
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return { allowed: true };
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, resetTime: record.resetTime };
  }

  // Increment count
  record.count++;
  rateLimitStore.set(ip, record);
  return { allowed: true };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract IP for rate limiting + captcha
    const ip = getRequestIp(req) || 'unknown';

    // Check rate limit
    const rateLimitCheck = checkRateLimit(ip);
    if (!rateLimitCheck.allowed) {
      const resetDate = new Date(rateLimitCheck.resetTime!);
      console.log(`Rate limit exceeded for IP: ${ip}`);
      return new Response(
        JSON.stringify({ 
          error: 'Too many registration attempts. Please try again later.',
          retry_after: resetDate.toISOString()
        }),
        {
          status: 429,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((rateLimitCheck.resetTime! - Date.now()) / 1000).toString()
          },
        }
      );
    }

    const body = await req.json();
    const { supplier_data, turnstile_token, company_slug, company_id } = body ?? {};

    // Verify Cloudflare Turnstile (bot protection)
    const captcha = await verifyTurnstile(turnstile_token, ip, "supplier_registration", "public_registration");
    if (!captcha.success) {
      return new Response(
        JSON.stringify({ error: 'Bot protection check failed', code: captcha.error }),
        { status: captcha.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate input data
    const validationResult = supplierDataSchema.safeParse(supplier_data);
    if (!validationResult.success) {
      console.log('Validation failed:', validationResult.error.issues);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input data',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const validatedData = validationResult.data;

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

    // Check for duplicates
    const { data: duplicates, error: dupError } = await supabaseAdmin.rpc('check_duplicate_supplier', {
      p_supplier_name: validatedData.supplier_name,
      p_email: validatedData.email,
      p_phone: validatedData.phone,
      p_tax_id: validatedData.tax_id || null,
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

    // Resolve company by slug if provided (and slug not bypassed by trusted company_id)
    let resolvedCompanyId: string | null = null;
    if (company_slug) {
      const { data: companyRow } = await supabaseAdmin.rpc('resolve_public_portal_company', { _slug: company_slug });
      if (companyRow && companyRow.length > 0) {
        resolvedCompanyId = companyRow[0].id;
      }
    }
    if (!resolvedCompanyId && typeof company_id === 'string') {
      // Verify supplied company_id actually maps to an active company
      const { data: c } = await supabaseAdmin.from('companies').select('id').eq('id', company_id).eq('status', 'active').maybeSingle();
      if (c) resolvedCompanyId = c.id;
    }

    // Create registration request
    const { data: registration, error: regError } = await supabaseAdmin
      .from('supplier_registration_requests')
      .insert({
        request_type: 'self_service',
        status: 'pending_approval',
        supplier_data: validatedData,
        company_id: resolvedCompanyId,
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
        to: [validatedData.email],
        subject: 'Supplier Registration Received',
        html: `
          <h1>Thank you for registering!</h1>
          <p>Dear ${validatedData.supplier_name},</p>
          <p>We have successfully received your supplier registration request.</p>
          <p><strong>Registration ID:</strong> ${registration.id}</p>
          <p>Our team will review your application and contact you within 2-3 business days.</p>
          <p>If you have any questions, please don't hesitate to reach out.</p>
          <br>
          <p>Best regards,<br>The Procurement Team</p>
        `,
      });
      console.log('Confirmation email sent to:', validatedData.email);
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
