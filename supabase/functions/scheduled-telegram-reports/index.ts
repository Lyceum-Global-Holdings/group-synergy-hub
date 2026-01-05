import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Check for force mode from request body
    let forceMode = false;
    let targetCompanyId: string | null = null;
    
    try {
      const body = await req.json();
      forceMode = body?.force === true;
      targetCompanyId = body?.company_id || null;
    } catch {
      // No body or invalid JSON, proceed normally
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (forceMode) {
      console.log('Force mode enabled - bypassing time check');
    }
    console.log('Checking for scheduled Telegram reports...');

    // Get current time in HH:MM format
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    
    console.log(`Current UTC time: ${currentTimeStr}`);

    // Get all companies with scheduled sending enabled
    const { data: settings, error: settingsError } = await supabase
      .from('telegram_settings')
      .select('*')
      .eq('is_enabled', true)
      .eq('scheduled_send_enabled', true)
      .not('scheduled_send_time', 'is', null)
      .not('bot_token', 'is', null)
      .not('chat_id', 'is', null);

    if (settingsError) {
      console.error('Error fetching telegram settings:', settingsError);
      throw settingsError;
    }

    if (!settings || settings.length === 0) {
      console.log('No companies with scheduled sending enabled');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No scheduled sends configured',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${settings.length} companies with scheduled sending enabled`);

    let processedCount = 0;
    const results: any[] = [];

    for (const setting of settings) {
      // Extract hour and minute from scheduled_send_time (format: "HH:MM:SS")
      const scheduledTime = setting.scheduled_send_time;
      if (!scheduledTime) continue;

      const [scheduledHour, scheduledMinute] = scheduledTime.split(':').map(Number);
      
      // Check if current time matches scheduled time (within the same minute) or force mode
      const timeMatches = currentHour === scheduledHour && currentMinute === scheduledMinute;
      const shouldProcess = forceMode || timeMatches;
      const companyMatches = !targetCompanyId || setting.company_id === targetCompanyId;
      
      if (shouldProcess && companyMatches) {
        console.log(`Processing company ${setting.company_id}${forceMode ? ' (forced)' : `: ${scheduledTime}`}`);

        // Check if we already sent today (prevent duplicate sends) - skip this check in force mode
        if (!forceMode) {
          const lastSend = setting.last_scheduled_send ? new Date(setting.last_scheduled_send) : null;
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          
          if (lastSend && lastSend >= today) {
            console.log(`Already sent today for company ${setting.company_id}, skipping`);
            continue;
          }
        }

        // Get today's reports for this company
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setUTCHours(23, 59, 59, 999);

        const { data: reports, error: reportsError } = await supabase
          .from('daily_site_reports')
          .select(`
            id,
            report_number,
            report_date,
            weather_conditions,
            temperature_high,
            temperature_low,
            safety_observations,
            work_summary,
            delays_issues,
            skilled_labor_count,
            unskilled_labor_count,
            subcontractor_count,
            visitor_count,
            status,
            project:construction_projects(project_name, project_code)
          `)
          .eq('company_id', setting.company_id)
          .gte('created_at', todayStart.toISOString())
          .lte('created_at', todayEnd.toISOString());

        if (reportsError) {
          console.error(`Error fetching reports for company ${setting.company_id}:`, reportsError);
          results.push({ company_id: setting.company_id, success: false, error: reportsError.message });
          continue;
        }

        if (!reports || reports.length === 0) {
          console.log(`No reports today for company ${setting.company_id}`);
          results.push({ company_id: setting.company_id, success: true, message: 'No reports today' });
          
          // Still update last_scheduled_send to prevent repeated checks
          await supabase
            .from('telegram_settings')
            .update({ last_scheduled_send: new Date().toISOString() })
            .eq('id', setting.id);
          
          continue;
        }

        console.log(`Found ${reports.length} reports for company ${setting.company_id}`);

        // Send each report via Telegram
        for (const report of reports) {
          try {
            const projectName = (report.project as any)?.project_name || 'Unknown Project';
            const projectCode = (report.project as any)?.project_code || '';
            
            // Format the message
            const message = formatReportMessage(report, projectName, projectCode);
            
            // Send to Telegram
            const telegramUrl = `https://api.telegram.org/bot${setting.bot_token}/sendMessage`;
            const telegramResponse = await fetch(telegramUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: setting.chat_id,
                text: message,
                parse_mode: 'HTML',
              }),
            });

            const telegramResult = await telegramResponse.json();
            
            if (!telegramResult.ok) {
              console.error(`Telegram error for report ${report.id}:`, telegramResult);
              results.push({ 
                company_id: setting.company_id, 
                report_id: report.id, 
                success: false, 
                error: telegramResult.description 
              });
            } else {
              console.log(`Successfully sent report ${report.id} to Telegram`);
              processedCount++;
              results.push({ 
                company_id: setting.company_id, 
                report_id: report.id, 
                success: true 
              });
            }
          } catch (sendError) {
            console.error(`Error sending report ${report.id}:`, sendError);
            results.push({ 
              company_id: setting.company_id, 
              report_id: report.id, 
              success: false, 
              error: String(sendError) 
            });
          }
        }

        // Update last_scheduled_send timestamp
        await supabase
          .from('telegram_settings')
          .update({ last_scheduled_send: new Date().toISOString() })
          .eq('id', setting.id);
      }
    }

    console.log(`Scheduled send complete. Processed ${processedCount} reports.`);

    return new Response(JSON.stringify({ 
      success: true, 
      processed: processedCount,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in scheduled-telegram-reports:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function formatReportMessage(report: any, projectName: string, projectCode: string): string {
  const weatherEmoji = getWeatherEmoji(report.weather_conditions);
  const statusEmoji = report.status === 'approved' ? '✅' : report.status === 'submitted' ? '📤' : '📝';
  
  let message = `<b>📋 Daily Site Report - Scheduled Summary</b>\n\n`;
  message += `<b>Report:</b> ${report.report_number}\n`;
  message += `<b>Project:</b> ${projectName} (${projectCode})\n`;
  message += `<b>Date:</b> ${report.report_date}\n`;
  message += `<b>Status:</b> ${statusEmoji} ${report.status?.charAt(0).toUpperCase() + report.status?.slice(1)}\n\n`;
  
  message += `<b>🌤 Weather Conditions</b>\n`;
  message += `${weatherEmoji} ${report.weather_conditions || 'Not recorded'}\n`;
  if (report.temperature_high) message += `🌡 High: ${report.temperature_high}°C\n`;
  if (report.temperature_low) message += `🌡 Low: ${report.temperature_low}°C\n`;
  
  message += `\n<b>👷 Workforce</b>\n`;
  message += `Skilled Labor: ${report.skilled_labor_count || 0}\n`;
  message += `Unskilled Labor: ${report.unskilled_labor_count || 0}\n`;
  message += `Subcontractors: ${report.subcontractor_count || 0}\n`;
  message += `Visitors: ${report.visitor_count || 0}\n`;
  
  if (report.safety_observations) {
    message += `\n<b>⚠️ Safety Observations</b>\n${report.safety_observations.substring(0, 300)}${report.safety_observations.length > 300 ? '...' : ''}\n`;
  }
  
  if (report.work_summary) {
    message += `\n<b>📝 Work Summary</b>\n${report.work_summary.substring(0, 500)}${report.work_summary.length > 500 ? '...' : ''}\n`;
  }
  
  if (report.delays_issues) {
    message += `\n<b>⏰ Delays/Issues</b>\n${report.delays_issues.substring(0, 300)}${report.delays_issues.length > 300 ? '...' : ''}\n`;
  }
  
  message += `\n<i>⏰ Automated scheduled report</i>`;
  
  return message;
}

function getWeatherEmoji(condition: string | null): string {
  if (!condition) return '🌤';
  const lower = condition.toLowerCase();
  if (lower.includes('sunny') || lower.includes('clear')) return '☀️';
  if (lower.includes('cloud')) return '☁️';
  if (lower.includes('rain')) return '🌧';
  if (lower.includes('storm') || lower.includes('thunder')) return '⛈';
  if (lower.includes('snow')) return '❄️';
  if (lower.includes('fog') || lower.includes('mist')) return '🌫';
  if (lower.includes('wind')) return '💨';
  return '🌤';
}
