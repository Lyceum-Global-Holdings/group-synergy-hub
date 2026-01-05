import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

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
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received request to send Telegram report");
    
    const { pdf_base64, filename, report_number, project_name, report_date, report_type }: TelegramReportRequest = await req.json();

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error("Telegram credentials not configured");
      throw new Error("Telegram credentials not configured. Please add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID secrets.");
    }

    console.log(`Sending report ${report_number} to Telegram chat ${TELEGRAM_CHAT_ID}`);

    // Decode base64 PDF
    const binaryString = atob(pdf_base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Create form data for Telegram API
    const formData = new FormData();
    formData.append("chat_id", TELEGRAM_CHAT_ID);
    formData.append("document", new Blob([bytes], { type: "application/pdf" }), filename);
    formData.append("caption", 
      `📋 *${report_type.toUpperCase()} SITE REPORT*\n\n` +
      `📌 Report: ${report_number}\n` +
      `🏗️ Project: ${project_name}\n` +
      `📅 Date: ${report_date}`
    );
    formData.append("parse_mode", "Markdown");

    // Send to Telegram
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,
      { method: "POST", body: formData }
    );

    const result = await response.json();
    
    if (!result.ok) {
      console.error("Telegram API error:", result);
      throw new Error(result.description || "Failed to send Telegram message");
    }

    console.log("Report sent successfully, message_id:", result.result.message_id);

    return new Response(
      JSON.stringify({ success: true, message_id: result.result.message_id }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending Telegram report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
