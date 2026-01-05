import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://cdn.skypack.dev/pdf-lib@1.17.1";

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
            project_id,
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

        // Send each report via Telegram as PDF
        for (const report of reports) {
          try {
            const projectName = (report.project as any)?.project_name || 'Unknown Project';
            const projectCode = (report.project as any)?.project_code || '';
            
            // Fetch material data for this report
            const materialsData = await fetchMaterialsData(supabase, report.project_id, report.report_date);
            
            // Generate PDF
            console.log(`Generating PDF for report ${report.report_number}...`);
            const pdfBytes = await generateReportPdf(report, projectName, projectCode, materialsData);
            
            // Send PDF to Telegram
            const telegramUrl = `https://api.telegram.org/bot${setting.bot_token}/sendDocument`;
            
            const formData = new FormData();
            formData.append('chat_id', setting.chat_id);
            formData.append('document', new Blob([pdfBytes], { type: 'application/pdf' }), `${report.report_number}.pdf`);
            formData.append('caption', formatCaption(report, projectName, projectCode));
            formData.append('parse_mode', 'HTML');
            
            const telegramResponse = await fetch(telegramUrl, {
              method: 'POST',
              body: formData,
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
              console.log(`Successfully sent PDF report ${report.id} to Telegram`);
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

// Fetch materials data for the report
async function fetchMaterialsData(supabase: any, projectId: string, reportDate: string) {
  const materialsData = {
    issues: [] as any[],
    adjustments: [] as any[],
    stockBalances: [] as any[],
  };

  try {
    // Fetch material issues for the report date
    const { data: issues } = await supabase
      .from('material_issues')
      .select(`
        id,
        issue_date,
        quantity,
        notes,
        warehouse_item:warehouse_items(item_name, item_code, unit_of_measure)
      `)
      .eq('project_id', projectId)
      .eq('issue_date', reportDate);
    
    if (issues) materialsData.issues = issues;

    // Fetch stock adjustments for the report date
    const { data: adjustments } = await supabase
      .from('stock_adjustments')
      .select(`
        id,
        adjustment_date,
        quantity_change,
        adjustment_type,
        reason,
        warehouse_item:warehouse_items(item_name, item_code, unit_of_measure)
      `)
      .eq('adjustment_date', reportDate);
    
    if (adjustments) materialsData.adjustments = adjustments;

    // Fetch current stock balances for project warehouse
    const { data: inventory } = await supabase
      .from('inventory_items')
      .select(`
        id,
        quantity,
        warehouse_item:warehouse_items(item_name, item_code, unit_of_measure)
      `)
      .eq('project_id', projectId)
      .gt('quantity', 0);
    
    if (inventory) materialsData.stockBalances = inventory;

  } catch (error) {
    console.error('Error fetching materials data:', error);
  }

  return materialsData;
}

// Generate PDF for the report
async function generateReportPdf(report: any, projectName: string, projectCode: string, materials: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const pageWidth = 595.28; // A4 width in points
  const pageHeight = 841.89; // A4 height in points
  const margin = 50;
  const lineHeight = 14;
  
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  
  const addText = (text: string, options: { bold?: boolean; size?: number; color?: any } = {}) => {
    const font = options.bold ? helveticaBold : helvetica;
    const size = options.size || 10;
    const color = options.color || rgb(0, 0, 0);
    
    if (y < margin + 50) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    
    // Handle text wrapping
    const maxWidth = pageWidth - margin * 2;
    const words = text.split(' ');
    let line = '';
    
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const width = font.widthOfTextAtSize(testLine, size);
      
      if (width > maxWidth && line) {
        page.drawText(line, { x: margin, y, size, font, color });
        y -= lineHeight;
        line = word;
        
        if (y < margin + 50) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
      } else {
        line = testLine;
      }
    }
    
    if (line) {
      page.drawText(line, { x: margin, y, size, font, color });
      y -= lineHeight;
    }
  };
  
  const addSection = (title: string) => {
    y -= 10;
    addText(title, { bold: true, size: 12, color: rgb(0.2, 0.4, 0.6) });
    y -= 5;
    // Draw underline
    page.drawLine({
      start: { x: margin, y: y + 8 },
      end: { x: pageWidth - margin, y: y + 8 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
  };
  
  const addKeyValue = (key: string, value: string) => {
    if (y < margin + 50) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(key + ':', { x: margin, y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
    const keyWidth = helveticaBold.widthOfTextAtSize(key + ': ', 10);
    page.drawText(value || 'N/A', { x: margin + keyWidth, y, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    y -= lineHeight;
  };
  
  // Header
  addText('DAILY SITE REPORT', { bold: true, size: 18, color: rgb(0.2, 0.4, 0.6) });
  y -= 10;
  
  // Report Info Section
  addSection('Report Information');
  addKeyValue('Report Number', report.report_number);
  addKeyValue('Project', `${projectName} (${projectCode})`);
  addKeyValue('Date', report.report_date);
  addKeyValue('Status', report.status?.charAt(0).toUpperCase() + report.status?.slice(1));
  
  // Weather Section
  addSection('Weather Conditions');
  addKeyValue('Conditions', report.weather_conditions || 'Not recorded');
  if (report.temperature_high) addKeyValue('High Temperature', `${report.temperature_high}°C`);
  if (report.temperature_low) addKeyValue('Low Temperature', `${report.temperature_low}°C`);
  
  // Workforce Section
  addSection('Workforce');
  addKeyValue('Skilled Labor', String(report.skilled_labor_count || 0));
  addKeyValue('Unskilled Labor', String(report.unskilled_labor_count || 0));
  addKeyValue('Subcontractors', String(report.subcontractor_count || 0));
  addKeyValue('Visitors', String(report.visitor_count || 0));
  const totalWorkforce = (report.skilled_labor_count || 0) + (report.unskilled_labor_count || 0) + 
                         (report.subcontractor_count || 0) + (report.visitor_count || 0);
  addKeyValue('Total On Site', String(totalWorkforce));
  
  // Work Summary
  if (report.work_summary) {
    addSection('Work Summary');
    addText(report.work_summary);
  }
  
  // Delays/Issues
  if (report.delays_issues) {
    addSection('Delays & Issues');
    addText(report.delays_issues);
  }
  
  // Safety Observations
  if (report.safety_observations) {
    addSection('Safety Observations');
    addText(report.safety_observations);
  }
  
  // Materials Issued
  if (materials.issues && materials.issues.length > 0) {
    addSection('Materials Issued Today');
    for (const issue of materials.issues) {
      const itemName = issue.warehouse_item?.item_name || 'Unknown Item';
      const itemCode = issue.warehouse_item?.item_code || '';
      const unit = issue.warehouse_item?.unit_of_measure || 'pcs';
      addText(`• ${itemName} (${itemCode}): ${issue.quantity} ${unit}`);
    }
  }
  
  // Stock Adjustments
  if (materials.adjustments && materials.adjustments.length > 0) {
    addSection('Stock Transactions Today');
    for (const adj of materials.adjustments) {
      const itemName = adj.warehouse_item?.item_name || 'Unknown Item';
      const sign = adj.quantity_change > 0 ? '+' : '';
      addText(`• ${itemName}: ${sign}${adj.quantity_change} (${adj.adjustment_type})`);
    }
  }
  
  // Current Stock Balances
  if (materials.stockBalances && materials.stockBalances.length > 0) {
    addSection('Current Stock Balances');
    for (const stock of materials.stockBalances.slice(0, 20)) { // Limit to 20 items
      const itemName = stock.warehouse_item?.item_name || 'Unknown Item';
      const unit = stock.warehouse_item?.unit_of_measure || 'pcs';
      addText(`• ${itemName}: ${stock.quantity} ${unit}`);
    }
    if (materials.stockBalances.length > 20) {
      addText(`... and ${materials.stockBalances.length - 20} more items`);
    }
  }
  
  // Footer
  y -= 20;
  addText(`Generated on ${new Date().toISOString().split('T')[0]} - Automated Scheduled Report`, { size: 8, color: rgb(0.5, 0.5, 0.5) });
  
  return await pdfDoc.save();
}

// Format caption for Telegram message
function formatCaption(report: any, projectName: string, projectCode: string): string {
  const statusEmoji = report.status === 'approved' ? '✅' : report.status === 'submitted' ? '📤' : '📝';
  const weatherEmoji = getWeatherEmoji(report.weather_conditions);
  
  const totalWorkforce = (report.skilled_labor_count || 0) + (report.unskilled_labor_count || 0) + 
                         (report.subcontractor_count || 0);
  
  let caption = `<b>📋 Daily Site Report</b>\n\n`;
  caption += `<b>Report:</b> ${report.report_number}\n`;
  caption += `<b>Project:</b> ${projectName} (${projectCode})\n`;
  caption += `<b>Date:</b> ${report.report_date}\n`;
  caption += `<b>Status:</b> ${statusEmoji} ${report.status?.charAt(0).toUpperCase() + report.status?.slice(1)}\n`;
  caption += `<b>Weather:</b> ${weatherEmoji} ${report.weather_conditions || 'Not recorded'}\n`;
  caption += `<b>Workforce:</b> 👷 ${totalWorkforce} workers\n\n`;
  caption += `<i>⏰ Automated scheduled report</i>`;
  
  return caption;
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
