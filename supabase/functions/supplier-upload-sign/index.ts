// Public edge function: issues a short-lived signed UPLOAD URL into the
// private `supplier-documents` bucket so anonymous suppliers can attach
// documents to their registration without ever seeing the service role key.
//
// Hardening:
//  - Cloudflare Turnstile verified (fails closed)
//  - Per-IP rate limit (30 sign requests / hour)
//  - Validates company slug, field key, mime, and size against the
//    PUBLISHED form schema for that company. No published file field => 403.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { verifyTurnstile, getRequestIp } from "../_shared/turnstile.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "supplier-documents";
const RATE_WINDOW = 60 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const rateStore = new Map<string, { count: number; resetTime: number }>();

const BodySchema = z.object({
  company_slug: z.string().trim().min(1).max(80),
  field_key: z.string().trim().min(1).max(120),
  filename: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(1).max(120),
  size: z.number().int().positive().max(50 * 1024 * 1024),
  turnstile_token: z.string().optional().nullable(),
});

function checkRate(ip: string) {
  const now = Date.now();
  const r = rateStore.get(ip);
  if (!r || r.resetTime < now) {
    rateStore.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  if (r.count >= MAX_PER_WINDOW) return false;
  r.count++;
  return true;
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function findFileField(schema: any, fieldKey: string): any | null {
  if (!schema?.sections) return null;
  for (const s of schema.sections) {
    for (const f of s.fields || []) {
      if (f.key === fieldKey && f.type === "file" && f.visible) return f;
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = getRequestIp(req) || "unknown";
    if (!checkRate(ip)) {
      return new Response(JSON.stringify({ error: "Too many upload requests" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.issues }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { company_slug, field_key, filename, mime, size, turnstile_token } = parsed.data;

    const captcha = await verifyTurnstile(turnstile_token ?? null, ip, "supplier_upload", "public_registration");
    if (!captcha.success) {
      return new Response(JSON.stringify({ error: "Bot protection check failed", code: captcha.error }), {
        status: captcha.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: rows, error: schemaErr } = await supabase.rpc("get_published_supplier_form", { _slug: company_slug });
    if (schemaErr || !rows || rows.length === 0 || !rows[0].company_id) {
      return new Response(JSON.stringify({ error: "Company not found or form not published" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { company_id, schema } = rows[0];

    const field = findFileField(schema, field_key);
    if (!field) {
      return new Response(JSON.stringify({ error: "Field not allowed" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accept: string[] = field.accept || ["application/pdf", "image/jpeg", "image/png"];
    const maxSizeMB: number = field.maxSizeMB ?? 10;
    if (!accept.includes(mime)) {
      return new Response(JSON.stringify({ error: `Mime not allowed (${mime})` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (size > maxSizeMB * 1024 * 1024) {
      return new Response(JSON.stringify({ error: `File exceeds ${maxSizeMB} MB` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uniq = crypto.randomUUID();
    const path = `pending/${company_id}/${field_key}/${uniq}-${safeName(filename)}`;

    const { data: signed, error: signErr } = await supabase
      .storage.from(BUCKET).createSignedUploadUrl(path);
    if (signErr || !signed) {
      console.error("sign error", signErr);
      return new Response(JSON.stringify({ error: "Failed to create signed URL" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      path,
      signed_url: signed.signedUrl,
      token: signed.token,
      expires_in: 3600,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("supplier-upload-sign error", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
