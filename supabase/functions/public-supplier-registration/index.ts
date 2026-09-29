import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { verifyTurnstile, getRequestIp } from "../_shared/turnstile.ts";
import { emailLayout, escapeHtml, sendEmail } from "../_shared/email.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Links in staff emails. Not taken from the request's Origin, which a script can set.
const APP_URL = (Deno.env.get('APP_URL') || 'https://stores.lgh.lk').replace(/\/+$/, '');

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

    // Duplicates: suppliers anywhere in the group, and applications already
    // waiting for this company (normalised tax ID, email, phone and name).
    const { data: duplicates, error: dupError } = await supabaseAdmin.rpc('find_supplier_duplicates', {
      p_data: validatedData,
      p_company_id: resolvedCompanyId,
    });

    if (dupError) {
      // Approval re-checks duplicates, so a failed check here doesn't let one through.
      console.error('Duplicate check error:', dupError);
    }

    if (duplicates && duplicates.length > 0) {
      const existingSupplier = duplicates.some((d: { kind: string }) => d.kind === 'supplier');
      return new Response(
        JSON.stringify({
          error: existingSupplier
            ? 'A supplier with similar information already exists. Please contact support if you believe this is an error.'
            : 'An application for this supplier is already being reviewed. We will contact you once it has been decided.',
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
        supplier_data: validatedData,
        company_id: resolvedCompanyId,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (regError) throw regError;

    // Persist any uploaded files referenced in supplier_data into supplier_documents.
    // Recognized shape: { path, name, size, mime } or arrays of that shape.
    try {
      const docRows: any[] = [];
      const isFileVal = (v: any) => v && typeof v === 'object' && typeof v.path === 'string' && typeof v.name === 'string';
      for (const [key, val] of Object.entries(validatedData as Record<string, any>)) {
        const arr = Array.isArray(val) ? val : [val];
        for (const f of arr) {
          if (!isFileVal(f)) continue;
          if (!f.path.startsWith('pending/')) continue; // only accept signed-upload paths
          // Confirm object actually exists in storage to prevent fake refs.
          const { data: head } = await supabaseAdmin.storage.from('supplier-documents')
            .createSignedUrl(f.path, 60);
          if (!head?.signedUrl) continue;
          docRows.push({
            registration_request_id: registration.id,
            document_type: key,
            file_name: f.name,
            file_url: f.path,
            file_size: typeof f.size === 'number' ? f.size : null,
          });
        }
      }
      if (docRows.length > 0) {
        const { error: docErr } = await supabaseAdmin.from('supplier_documents').insert(docRows);
        if (docErr) console.error('supplier_documents insert error', docErr);
      }
    } catch (e) {
      console.error('document persistence error', e);
    }

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

    const { data: companyInfo } = resolvedCompanyId
      ? await supabaseAdmin.from('companies').select('name').eq('id', resolvedCompanyId).maybeSingle()
      : { data: null };
    const companyName: string | null = companyInfo?.name ?? null;
    const d = validatedData as Record<string, unknown>;

    // Confirmation to the applicant. Emails never fail the registration.
    const confirmation = await sendEmail({
      to: validatedData.email,
      subject: 'Supplier registration received',
      html: emailLayout({
        heading: 'Thank you for registering',
        body: `<p>We have received the supplier registration for <b>${escapeHtml(validatedData.supplier_name)}</b>${companyName ? ` with ${escapeHtml(companyName)}` : ''}.</p>
               <p><b>Reference:</b> ${escapeHtml(registration.id)}</p>
               <p>Our procurement team will review it and email you the decision.</p>`,
      }),
    });
    if (!confirmation.sent) console.error('Confirmation email not sent:', confirmation.error);

    // Tell the company's procurement staff there is an application to review.
    const { data: reviewers, error: reviewersError } = await supabaseAdmin.rpc('supplier_registration_reviewers', {
      p_company_id: resolvedCompanyId,
    });
    if (reviewersError) console.error('Reviewer lookup error:', reviewersError);
    const staff = ((reviewers ?? []) as { email: string }[]).map((r) => r.email).filter(Boolean);
    if (staff.length > 0) {
      const row = (label: string, value: unknown) =>
        value ? `<tr><td style="padding:2px 12px 2px 0;color:#6b7686">${label}</td><td>${escapeHtml(value)}</td></tr>` : '';
      const alert = await sendEmail({
        to: staff,
        subject: `New supplier application: ${validatedData.supplier_name}`,
        html: emailLayout({
          heading: 'New supplier application',
          body: `<p><b>${escapeHtml(validatedData.supplier_name)}</b> applied through the public registration form${companyName ? ` to supply <b>${escapeHtml(companyName)}</b>` : ''}.</p>
                 <table style="font-size:14px;border-collapse:collapse">
                   ${row('Email', d.email)}${row('Phone', d.phone)}${row('Contact', d.primary_contact_name)}${row('Country', d.country)}${row('Tax ID', d.tax_id)}
                 </table>
                 <p>Review it in Sourcing › Supplier Registration › Approval Dashboard.</p>`,
          action: { label: 'Review the application', url: `${APP_URL}/sourcing/supplier-registration` },
          footer: `You receive this because you handle supplier registrations${companyName ? ` for ${companyName}` : ''}.`,
        }),
      });
      if (!alert.sent) console.error('Staff alert not sent:', alert.error);
    } else {
      console.warn('No reviewers to notify for company', resolvedCompanyId);
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
