import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Fallback to environment variables if not provided in request
const DEFAULT_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const DEFAULT_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

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
  bot_token?: string;
  chat_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Received request to send Telegram report");
    
    const { 
      pdf_base64, 
      filename, 
      report_number, 
      project_name, 
      report_date, 
      report_type,
      bot_token,
      chat_id 
    }: TelegramReportRequest = await req.json();

    // Use provided credentials or fall back to environment variables
    const telegramBotToken = bot_token || DEFAULT_BOT_TOKEN;
    const telegramChatIdString = chat_id || DEFAULT_CHAT_ID;

    if (!telegramBotToken || !telegramChatIdString) {
      console.error("Telegram credentials not configured");
      throw new Error("Telegram credentials not configured. Please configure Telegram settings.");
    }

    // Parse multiple chat IDs (comma-separated)
    const chatIds = telegramChatIdString.split(',').map(id => id.trim()).filter(Boolean);
    
    if (chatIds.length === 0) {
      throw new Error("No valid chat IDs provided");
    }

    console.log(`Sending report ${report_number} to ${chatIds.length} Telegram chat(s): ${chatIds.join(', ')}`);

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
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
