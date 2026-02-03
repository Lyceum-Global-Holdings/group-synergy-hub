import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TelegramReportRequest {
  pdf_base64: string;
  filename: string;
  report_number: string;
  project_name: string;
  report_date: string;
  report_type: string;
  company_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Received request to send Telegram report from user:", user.id);
    
    const { 
      pdf_base64, 
      filename, 
      report_number, 
      project_name, 
      report_date, 
      report_type,
      company_id
    }: TelegramReportRequest = await req.json();

    if (!company_id) {
      return new Response(
        JSON.stringify({ error: 'Company ID is required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user belongs to this company or is super admin
    const { data: membership } = await supabase
      .from('user_companies')
      .select('id')
      .eq('user_id', user.id)
      .eq('company_id', company_id)
      .maybeSingle();

    if (!membership) {
      const { data: isSuperAdmin } = await supabase.rpc('is_super_admin', { _user_id: user.id });
      if (!isSuperAdmin) {
        return new Response(
          JSON.stringify({ error: 'Access denied to this company' }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch Telegram credentials from database (server-side only)
    const { data: settings, error: settingsError } = await supabase
      .from('telegram_settings')
      .select('bot_token, chat_id, is_enabled')
      .eq('company_id', company_id)
      .maybeSingle();

    if (settingsError) {
      console.error("Error fetching telegram settings:", settingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Telegram settings' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings?.bot_token || !settings?.chat_id) {
      console.error("Telegram credentials not configured for company:", company_id);
      return new Response(
        JSON.stringify({ error: 'Telegram credentials not configured. Please configure Telegram settings.' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.is_enabled) {
      return new Response(
        JSON.stringify({ error: 'Telegram integration is disabled for this company' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telegramBotToken = settings.bot_token;
    const chatIds = settings.chat_id.split(',').map((id: string) => id.trim()).filter(Boolean);
    
    if (chatIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid chat IDs configured' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending report ${report_number} to ${chatIds.length} Telegram chat(s)`);

    // Decode base64 PDF
    const binaryString = atob(pdf_base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const caption = `📋 *${report_type.toUpperCase()} SITE REPORT*\n\n` +
      `📌 Report: ${report_number}\n` +
      `🏗️ Project: ${project_name}\n` +
      `📅 Date: ${report_date}`;

    // Send to each chat ID
    const results: { chatId: string; success: boolean; message_id?: number; error?: string }[] = [];
    
    for (const chatId of chatIds) {
      try {
        const formData = new FormData();
        formData.append("chat_id", chatId);
        formData.append("document", new Blob([bytes], { type: "application/pdf" }), filename);
        formData.append("caption", caption);
        formData.append("parse_mode", "Markdown");

        const response = await fetch(
          `https://api.telegram.org/bot${telegramBotToken}/sendDocument`,
          { method: "POST", body: formData }
        );

        const result = await response.json();
        
        if (!result.ok) {
          console.error(`Telegram API error for chat ${chatId}:`, result);
          results.push({ chatId, success: false, error: result.description });
        } else {
          console.log(`Report sent successfully to chat ${chatId}, message_id:`, result.result.message_id);
          results.push({ chatId, success: true, message_id: result.result.message_id });
        }
      } catch (err) {
        console.error(`Error sending to chat ${chatId}:`, err);
        results.push({ chatId, success: false, error: String(err) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Sent to ${successCount}/${chatIds.length} chats`);

    return new Response(
      JSON.stringify({ 
        success: successCount > 0, 
        sent_count: successCount,
        total_chats: chatIds.length,
        results 
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending Telegram report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
