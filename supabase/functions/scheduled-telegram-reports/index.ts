import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Type definitions to match client-side
interface DailyMaterialIssue {
  min_number: string;
  issued_to: string | null;
  department: string | null;
  item_code: string | null;
  item_name: string;
  quantity_issued: number;
}

interface DailyStockAdjustment {
  transaction_type: string;
  item_code: string | null;
  item_name: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  adjustment_notes: string | null;
  adjusted_by: string | null;
  issued_to_location_name?: string | null;
}

interface CurrentStockBalance {
  item_code: string | null;
  item_name: string;
  current_stock: number;
  warehouse_id: string | null;
  warehouse_name: string | null;
}

interface MaterialsData {
  issues: DailyMaterialIssue[];
  adjustments: DailyStockAdjustment[];
  stockBalances: CurrentStockBalance[];
}

// Timezone offset mapping (approximate, doesn't handle DST perfectly but good enough)
const TIMEZONE_OFFSETS: Record<string, number> = {
  'UTC': 0,
  'Asia/Dubai': 4,
  'Asia/Kolkata': 5.5,
  'Asia/Singapore': 8,
  'Asia/Tokyo': 9,
  'Europe/London': 0, // Could be +1 in summer
  'Europe/Paris': 1, // Could be +2 in summer
  'America/New_York': -5, // Could be -4 in summer
  'America/Los_Angeles': -8, // Could be -7 in summer
};

// Check if current UTC time matches the scheduled time in user's timezone
function checkTimeMatch(nowUtc: Date, scheduledTime: string, userTimezone: string): boolean {
  const [scheduledHour, scheduledMinute] = scheduledTime.split(':').map(Number);
  
  // Get offset for the user's timezone (in hours, can be fractional like 5.5 for India)
  const offsetHours = TIMEZONE_OFFSETS[userTimezone] ?? 0;
  
  // Convert offset to total minutes for easier calculation
  const offsetMinutes = Math.round(offsetHours * 60);
  
  // Convert scheduled time to total minutes from midnight
  const scheduledTotalMinutes = scheduledHour * 60 + scheduledMinute;
  
  // Convert to UTC by subtracting the offset
  let utcTotalMinutes = scheduledTotalMinutes - offsetMinutes;
  
  // Handle day wraparound
  if (utcTotalMinutes < 0) utcTotalMinutes += 24 * 60;
  if (utcTotalMinutes >= 24 * 60) utcTotalMinutes -= 24 * 60;
  
  // Extract hour and minute
  const expectedUtcHour = Math.floor(utcTotalMinutes / 60);
  const expectedUtcMinute = utcTotalMinutes % 60;
  
  const currentUtcHour = nowUtc.getUTCHours();
  const currentUtcMinute = nowUtc.getUTCMinutes();
  
  console.log(`Time check: scheduled ${scheduledHour}:${scheduledMinute} (${userTimezone}) = ${expectedUtcHour}:${expectedUtcMinute} UTC, current: ${currentUtcHour}:${currentUtcMinute} UTC`);
  
  return currentUtcHour === expectedUtcHour && currentUtcMinute === expectedUtcMinute;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let forceMode = false;
    let targetCompanyId: string | null = null;
    
    try {
      const body = await req.json();
      forceMode = body?.force === true;
      targetCompanyId = body?.company_id || null;
    } catch {
      // No body or invalid JSON
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (forceMode) {
      console.log('Force mode enabled - bypassing time check');
    }
    console.log('Checking for scheduled Telegram reports...');

    const now = new Date();
    console.log(`Current UTC time: ${now.toISOString()}`);

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
      const scheduledTime = setting.scheduled_send_time;
      if (!scheduledTime) continue;

      // Convert scheduled time from user's timezone to UTC for comparison
      const timeMatches = checkTimeMatch(now, scheduledTime, setting.timezone || 'UTC');
      const shouldProcess = forceMode || timeMatches;
      const companyMatches = !targetCompanyId || setting.company_id === targetCompanyId;
      
      if (!forceMode) {
        console.log(`Company ${setting.company_id}: scheduled at ${scheduledTime} (${setting.timezone || 'UTC'}), matches: ${timeMatches}`);
      }
      
      if (shouldProcess && companyMatches) {
        console.log(`Processing company ${setting.company_id}${forceMode ? ' (forced)' : `: ${scheduledTime}`}`);

        if (!forceMode) {
          const lastSend = setting.last_scheduled_send ? new Date(setting.last_scheduled_send) : null;
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          
          if (lastSend && lastSend >= today) {
            console.log(`Already sent today for company ${setting.company_id}, skipping`);
            continue;
          }
        }

        // Get today's date in YYYY-MM-DD format for report_date comparison
        const today = new Date();
        const todayDateStr = today.toISOString().split('T')[0];
        console.log(`Looking for reports with report_date: ${todayDateStr}`);

        const { data: reports, error: reportsError } = await supabase
          .from('daily_site_reports')
          .select(`
            id,
            report_number,
            report_type,
            report_date,
            period_start_date,
            period_end_date,
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
            company_id,
            project:construction_projects(project_name, project_code)
          `)
          .eq('company_id', setting.company_id)
          .eq('report_date', todayDateStr);

        if (reportsError) {
          console.error(`Error fetching reports for company ${setting.company_id}:`, reportsError);
          results.push({ company_id: setting.company_id, success: false, error: reportsError.message });
          continue;
        }

        if (!reports || reports.length === 0) {
          console.log(`No reports today for company ${setting.company_id}`);
          results.push({ company_id: setting.company_id, success: true, message: 'No reports today' });
          
          await supabase
            .from('telegram_settings')
            .update({ last_scheduled_send: new Date().toISOString() })
            .eq('id', setting.id);
          
          continue;
        }

        console.log(`Found ${reports.length} reports for company ${setting.company_id}`);

        for (const report of reports) {
          try {
            const projectName = (report.project as any)?.project_name || 'Unknown Project';
            const projectCode = (report.project as any)?.project_code || '';
            
            // Use period dates for range, or just report_date for daily
            const periodStart = report.period_start_date || report.report_date;
            const periodEnd = report.period_end_date || report.report_date;
            
            // Fetch materials data matching the client-side queries
            console.log(`Fetching materials data for report ${report.report_number}...`);
            const materialsData = await fetchMaterialsData(supabase, setting.company_id, periodStart, periodEnd);
            console.log(`Found ${materialsData.issues.length} issues, ${materialsData.adjustments.length} adjustments, ${materialsData.stockBalances.length} stock balances`);
            
            // Generate PDF matching the client-side format
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

// Fetch materials data matching the client-side useDailyMaterialsActivity hook
async function fetchMaterialsData(
  supabase: any, 
  companyId: string, 
  startDate: string, 
  endDate: string
): Promise<MaterialsData> {
  const materialsData: MaterialsData = {
    issues: [],
    adjustments: [],
    stockBalances: [],
  };

  try {
    // 1. Fetch material issues - matching client-side query
    const { data: issuesData, error: issuesError } = await supabase
      .from("material_issue_notes")
      .select(`
        min_number,
        issued_to,
        department,
        material_issue_items (
          quantity_issued,
          notes,
          warehouse_items (
            item_code,
            name
          )
        )
      `)
      .eq("company_id", companyId)
      .gte("issue_date", startDate)
      .lte("issue_date", endDate);

    if (issuesError) {
      console.error("Error fetching material issues:", issuesError);
    } else if (issuesData) {
      // Flatten the data structure like client-side
      issuesData.forEach((issue: any) => {
        issue.material_issue_items?.forEach((item: any) => {
          materialsData.issues.push({
            min_number: issue.min_number,
            issued_to: issue.issued_to,
            department: issue.department,
            item_code: item.warehouse_items?.item_code || null,
            item_name: item.warehouse_items?.name || "Unknown Item",
            quantity_issued: item.quantity_issued,
          });
        });
      });
    }

    // 2. Fetch stock adjustments - matching client-side query
    const { data: adjustmentsData, error: adjustmentsError } = await supabase
      .from("stock_transactions")
      .select(`
        transaction_type,
        quantity_change,
        quantity_before,
        quantity_after,
        notes,
        created_by,
        issued_to_location_id,
        issued_to_location:issued_to_location_id (
          name
        ),
        warehouse_items!inner (
          item_code,
          name,
          company_id
        )
      `)
      .eq("warehouse_items.company_id", companyId)
      .or("transaction_type.not.in.(\"material_issue\",\"material_return\"),and(transaction_type.eq.material_issue,issued_to_location_id.not.is.null)")
      .gte("created_at", `${startDate}T00:00:00`)
      .lt("created_at", `${endDate}T23:59:59.999`);

    if (adjustmentsError) {
      console.error("Error fetching stock adjustments:", adjustmentsError);
    } else if (adjustmentsData) {
      // Fetch profiles for adjusted_by names
      const userIds = [...new Set(adjustmentsData.map((t: any) => t.created_by).filter(Boolean))] as string[];
      let profilesMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);
        
        if (profilesData) {
          profilesMap = profilesData.reduce((acc: Record<string, string>, profile: any) => {
            acc[profile.user_id] = profile.full_name || profile.email || 'Unknown';
            return acc;
          }, {});
        }
      }

      materialsData.adjustments = adjustmentsData.map((adj: any) => {
        const displayType = adj.transaction_type === "material_issue" && adj.issued_to_location_id 
          ? "sublocation_issue" 
          : adj.transaction_type || "adjustment";
        
        return {
          transaction_type: displayType,
          item_code: adj.warehouse_items?.item_code || null,
          item_name: adj.warehouse_items?.name || "Unknown Item",
          quantity_change: adj.quantity_change,
          quantity_before: adj.quantity_before,
          quantity_after: adj.quantity_after,
          adjustment_notes: adj.notes,
          adjusted_by: adj.created_by ? profilesMap[adj.created_by] || null : null,
          issued_to_location_name: adj.issued_to_location?.name || null,
        };
      });
    }

    // 3. Fetch current stock balances from bin allocations - matching client-side query
    const { data: stockData, error: stockError } = await supabase
      .from("warehouse_bin_allocations")
      .select(`
        allocated_quantity,
        company_id,
        warehouse_items:warehouse_item_id (
          id,
          item_code,
          name
        ),
        warehouse_bins:bin_id (
          location_id,
          warehouse_locations:location_id (
            id,
            name
          )
        )
      `)
      .eq("company_id", companyId)
      .gt("allocated_quantity", 0);

    if (stockError) {
      console.error("Error fetching stock balances:", stockError);
    } else if (stockData) {
      // Group by item_code + warehouse to aggregate stock
      const stockMap = new Map<string, CurrentStockBalance>();
      
      stockData.forEach((allocation: any) => {
        const itemCode = allocation.warehouse_items?.item_code || "";
        const warehouseId = allocation.warehouse_bins?.warehouse_locations?.id || "";
        const key = `${itemCode}-${warehouseId}`;
        
        if (stockMap.has(key)) {
          const existing = stockMap.get(key)!;
          existing.current_stock += allocation.allocated_quantity || 0;
        } else {
          stockMap.set(key, {
            item_code: allocation.warehouse_items?.item_code || null,
            item_name: allocation.warehouse_items?.name || "Unknown Item",
            current_stock: allocation.allocated_quantity || 0,
            warehouse_id: allocation.warehouse_bins?.warehouse_locations?.id || null,
            warehouse_name: allocation.warehouse_bins?.warehouse_locations?.name || null,
          });
        }
      });
      
      materialsData.stockBalances = Array.from(stockMap.values());
    }

  } catch (error) {
    console.error('Error in fetchMaterialsData:', error);
  }

  return materialsData;
}

// Format date like client-side "MMMM d, yyyy" or range
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = ["January", "February", "March", "April", "May", "June", 
                  "July", "August", "September", "October", "November", "December"];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function formatDateWithYear(dateStr: string): string {
  const date = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// Get transaction type label matching client-side
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    adjustment: "Adjustment",
    goods_receipt: "Goods Receipt",
    opening_stock: "Opening Stock",
    transfer_in: "Transfer In",
    transfer_out: "Transfer Out",
    project_issue: "Project Issue",
    project_return: "Project Return",
    sublocation_issue: "Sub-Location Issue",
  };
  return labels[type] || type.replace(/_/g, ' ');
}

// Generate PDF matching the client-side jspdf + jspdf-autotable format
async function generateReportPdf(
  report: any, 
  projectName: string, 
  projectCode: string, 
  materials: MaterialsData
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const pageWidth = 595.28; // A4 width
  const pageHeight = 841.89; // A4 height
  const margin = 14 * 2.83465; // Convert 14px to points (approx)
  const lineHeight = 12;
  const smallLineHeight = 10;
  
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 20;
  
  // Helper to add new page if needed
  const checkPageBreak = (neededSpace: number = 50) => {
    if (y < neededSpace) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 20;
    }
  };
  
  // Helper to draw text
  const drawText = (text: string, x: number, options: { bold?: boolean; size?: number; color?: any; align?: 'left' | 'right' | 'center' } = {}) => {
    const font = options.bold ? helveticaBold : helvetica;
    const size = options.size || 10;
    const color = options.color || rgb(0, 0, 0);
    const cleanText = (text || '').replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');
    
    let drawX = x;
    if (options.align === 'right') {
      const width = font.widthOfTextAtSize(cleanText, size);
      drawX = pageWidth - margin - width;
    } else if (options.align === 'center') {
      const width = font.widthOfTextAtSize(cleanText, size);
      drawX = (pageWidth - width) / 2;
    }
    
    page.drawText(cleanText, { x: drawX, y, size, font, color });
  };
  
  // Helper to wrap and draw multiline text
  const drawWrappedText = (text: string, options: { size?: number } = {}) => {
    const size = options.size || 10;
    const maxWidth = pageWidth - margin * 2;
    const cleanText = (text || '').replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');
    const words = cleanText.split(' ');
    let line = '';
    
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const width = helvetica.widthOfTextAtSize(testLine, size);
      
      if (width > maxWidth && line) {
        checkPageBreak(50);
        page.drawText(line, { x: margin, y, size, font: helvetica, color: rgb(0, 0, 0) });
        y -= smallLineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    
    if (line) {
      checkPageBreak(50);
      page.drawText(line, { x: margin, y, size, font: helvetica, color: rgb(0, 0, 0) });
      y -= smallLineHeight;
    }
  };
  
  // Helper to draw a simple table
  const drawTable = (
    headers: string[], 
    rows: string[][], 
    headerColor: { r: number; g: number; b: number }
  ) => {
    const colWidths = headers.map((_, i) => {
      // Calculate column widths based on content
      const headerWidth = helveticaBold.widthOfTextAtSize(headers[i], 8);
      let maxDataWidth = 0;
      rows.forEach(row => {
        const dataWidth = helvetica.widthOfTextAtSize(row[i] || '-', 8);
        maxDataWidth = Math.max(maxDataWidth, dataWidth);
      });
      return Math.max(headerWidth, maxDataWidth) + 10;
    });
    
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);
    const scale = totalWidth > (pageWidth - margin * 2) ? (pageWidth - margin * 2) / totalWidth : 1;
    const scaledWidths = colWidths.map(w => w * scale);
    
    // Draw header row
    checkPageBreak(50);
    const headerHeight = 16;
    page.drawRectangle({
      x: margin,
      y: y - headerHeight + 4,
      width: pageWidth - margin * 2,
      height: headerHeight,
      color: rgb(headerColor.r / 255, headerColor.g / 255, headerColor.b / 255),
    });
    
    let xPos = margin + 3;
    headers.forEach((header, i) => {
      page.drawText(header, { 
        x: xPos, 
        y: y - 6, 
        size: 8, 
        font: helveticaBold, 
        color: rgb(1, 1, 1) 
      });
      xPos += scaledWidths[i];
    });
    y -= headerHeight + 2;
    
    // Draw data rows
    rows.forEach((row, rowIndex) => {
      checkPageBreak(50);
      
      // Alternate row background
      if (rowIndex % 2 === 1) {
        page.drawRectangle({
          x: margin,
          y: y - 10,
          width: pageWidth - margin * 2,
          height: 14,
          color: rgb(0.95, 0.95, 0.95),
        });
      }
      
      xPos = margin + 3;
      row.forEach((cell, i) => {
        const truncatedCell = (cell || '-').substring(0, 30);
        page.drawText(truncatedCell, { 
          x: xPos, 
          y: y - 6, 
          size: 8, 
          font: helvetica, 
          color: rgb(0, 0, 0) 
        });
        xPos += scaledWidths[i];
      });
      y -= 14;
    });
    
    y -= 10;
  };
  
  // ===== HEADER =====
  drawText('DAILY SITE REPORT', margin, { bold: true, size: 18, align: 'center' });
  y -= 20;
  
  // ===== REPORT INFO =====
  drawText(`Report #: ${report.report_number}`, margin, { size: 12 });
  drawText(`Type: ${(report.report_type || 'DAILY').toUpperCase()}`, margin, { size: 12, align: 'right' });
  y -= lineHeight;
  
  drawText(`Project: ${projectName || 'N/A'}`, margin, { size: 12 });
  drawText(`Status: ${(report.status || 'DRAFT').toUpperCase()}`, margin, { size: 12, align: 'right' });
  y -= lineHeight;
  
  // Period
  let periodText = formatDate(report.report_date);
  if (report.report_type !== 'daily' && report.period_start_date && report.period_end_date) {
    periodText = `${formatShortDate(report.period_start_date)} - ${formatDateWithYear(report.period_end_date)}`;
  }
  drawText(`Period: ${periodText}`, margin, { size: 12 });
  y -= 18;
  
  // Divider
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: rgb(0.78, 0.78, 0.78),
  });
  y -= 12;
  
  // ===== CONDITIONS & WORKFORCE =====
  drawText('Conditions & Workforce', margin, { bold: true, size: 11 });
  y -= lineHeight;
  
  // Weather
  drawText(`Weather: ${report.weather_conditions || 'N/A'}`, margin, { size: 10 });
  y -= smallLineHeight;
  
  let tempText = 'N/A';
  if (report.temperature_high && report.temperature_low) {
    tempText = `High: ${report.temperature_high}°F / Low: ${report.temperature_low}°F`;
  }
  drawText(`Temperature: ${tempText}`, margin, { size: 10 });
  y -= smallLineHeight + 4;
  
  // Labor
  const totalLabor = (report.skilled_labor_count || 0) + (report.unskilled_labor_count || 0);
  drawText(`Total Labor: ${totalLabor}`, margin, { size: 10 });
  y -= smallLineHeight;
  drawText(`Skilled: ${report.skilled_labor_count || 0}`, margin, { size: 10 });
  y -= smallLineHeight;
  drawText(`Non-Skilled: ${report.unskilled_labor_count || 0}`, margin, { size: 10 });
  y -= smallLineHeight;
  drawText(`Subcontractors: ${report.subcontractor_count || 0}`, margin, { size: 10 });
  y -= smallLineHeight;
  drawText(`Visitors: ${report.visitor_count || 0}`, margin, { size: 10 });
  y -= smallLineHeight + 8;
  
  // ===== WORK SUMMARY =====
  if (report.work_summary) {
    drawText('Work Summary', margin, { bold: true, size: 11 });
    y -= smallLineHeight;
    drawWrappedText(report.work_summary, { size: 10 });
    y -= 8;
  }
  
  // ===== DELAYS/ISSUES =====
  if (report.delays_issues) {
    drawText('Delays/Issues', margin, { bold: true, size: 11 });
    y -= smallLineHeight;
    drawWrappedText(report.delays_issues, { size: 10 });
    y -= 8;
  }
  
  // ===== SAFETY OBSERVATIONS =====
  if (report.safety_observations) {
    drawText('Safety Observations', margin, { bold: true, size: 11 });
    y -= smallLineHeight;
    drawWrappedText(report.safety_observations, { size: 10 });
    y -= 8;
  }
  
  // ===== MATERIAL ACTIVITY =====
  checkPageBreak(100);
  drawText('Material Activity', margin, { bold: true, size: 12 });
  y -= 16;
  
  // Items Issued Table
  if (materials.issues.length > 0) {
    drawText(`Items Issued (${materials.issues.length})`, margin, { bold: true, size: 10 });
    y -= 6;
    
    const issueHeaders = ['MIN#', 'Code', 'Item', 'Qty Issued', 'Issued To', 'Department'];
    const issueRows = materials.issues.map(item => [
      item.min_number || '-',
      item.item_code || '-',
      item.item_name,
      String(item.quantity_issued),
      item.issued_to || '-',
      item.department || '-',
    ]);
    
    drawTable(issueHeaders, issueRows, { r: 66, g: 139, b: 202 }); // Blue header
  }
  
  // Stock Transactions Table
  if (materials.adjustments.length > 0) {
    checkPageBreak(80);
    drawText(`Stock Transactions (${materials.adjustments.length})`, margin, { bold: true, size: 10 });
    y -= 6;
    
    const adjHeaders = ['Type', 'Code', 'Item', 'Change', 'Before', 'After', 'Notes', 'By'];
    const adjRows = materials.adjustments.map(item => {
      const notes = item.issued_to_location_name 
        ? `To: ${item.issued_to_location_name}${item.adjustment_notes ? ` - ${item.adjustment_notes}` : ""}`
        : item.adjustment_notes || '-';
      return [
        getTypeLabel(item.transaction_type),
        item.item_code || '-',
        item.item_name,
        item.quantity_change > 0 ? `+${item.quantity_change}` : String(item.quantity_change),
        String(item.quantity_before),
        String(item.quantity_after),
        notes.substring(0, 20),
        item.adjusted_by || '-',
      ];
    });
    
    drawTable(adjHeaders, adjRows, { r: 240, g: 173, b: 78 }); // Orange header
  }
  
  // ===== CURRENT STOCK BALANCES =====
  if (materials.stockBalances.length > 0) {
    checkPageBreak(100);
    drawText('Current Stock Balances', margin, { bold: true, size: 12 });
    y -= 12;
    
    // Sort stock balances by item name, then warehouse
    const sortedStockBalances = [...materials.stockBalances].sort((a, b) => {
      const nameA = a.item_name || "";
      const nameB = b.item_name || "";
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      const warehouseA = a.warehouse_name || "Unassigned";
      const warehouseB = b.warehouse_name || "Unassigned";
      return warehouseA.localeCompare(warehouseB);
    });
    
    // Calculate total stock per item
    const itemTotals = materials.stockBalances.reduce((acc, item) => {
      const itemCode = item.item_code || "unknown";
      acc[itemCode] = (acc[itemCode] || 0) + item.current_stock;
      return acc;
    }, {} as Record<string, number>);
    
    // Group by warehouse for summary
    const stockByWarehouse = sortedStockBalances.reduce((acc, item) => {
      const warehouseName = item.warehouse_name || "Unassigned";
      if (!acc[warehouseName]) {
        acc[warehouseName] = { items: [] as CurrentStockBalance[], totalStock: 0 };
      }
      acc[warehouseName].items.push(item);
      acc[warehouseName].totalStock += item.current_stock;
      return acc;
    }, {} as Record<string, { items: CurrentStockBalance[]; totalStock: number }>);
    
    // Stock by Warehouse summary table
    drawText('Stock by Warehouse', margin, { bold: true, size: 10 });
    y -= 6;
    
    const warehouseHeaders = ['Warehouse', 'Items Count', 'Total Stock'];
    const warehouseRows = Object.entries(stockByWarehouse).map(([name, data]) => [
      name,
      String(data.items.length),
      String(data.totalStock),
    ]);
    
    drawTable(warehouseHeaders, warehouseRows, { r: 92, g: 184, b: 92 }); // Green header
    
    // Detailed Stock Balances table
    checkPageBreak(80);
    drawText('Detailed Stock Balances', margin, { bold: true, size: 10 });
    y -= 6;
    
    const detailHeaders = ['Code', 'Item', 'Current Stock', 'Warehouse', 'Total Stock'];
    const detailRows = sortedStockBalances.map(item => [
      item.item_code || '-',
      item.item_name,
      String(item.current_stock),
      item.warehouse_name || 'Unassigned',
      String(itemTotals[item.item_code || "unknown"] || 0),
    ]);
    
    drawTable(detailHeaders, detailRows, { r: 91, g: 192, b: 222 }); // Cyan header
  }
  
  // ===== FOOTER =====
  const pageCount = pdfDoc.getPageCount();
  const now = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hours = now.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const footerText = `Generated on ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()} at ${displayHours}:${now.getMinutes().toString().padStart(2, '0')} ${ampm}`;
  
  const pages = pdfDoc.getPages();
  pages.forEach((p, i) => {
    const fullFooter = `${footerText} | Page ${i + 1} of ${pageCount}`;
    const footerWidth = helvetica.widthOfTextAtSize(fullFooter, 8);
    p.drawText(fullFooter, {
      x: (pageWidth - footerWidth) / 2,
      y: 15,
      size: 8,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
  });
  
  return await pdfDoc.save();
}

// Format caption for Telegram message
function formatCaption(report: any, projectName: string, projectCode: string): string {
  const statusEmoji = report.status === 'approved' ? '✅' : report.status === 'submitted' ? '📤' : '📝';
  const weatherEmoji = getWeatherEmoji(report.weather_conditions);
  
  const totalWorkforce = (report.skilled_labor_count || 0) + (report.unskilled_labor_count || 0) + 
                         (report.subcontractor_count || 0);
  
  return `${statusEmoji} <b>Daily Site Report</b>\n` +
         `📋 ${report.report_number}\n` +
         `🏗️ ${projectName} (${projectCode})\n` +
         `📅 ${report.report_date}\n` +
         `${weatherEmoji} ${report.weather_conditions || 'N/A'}\n` +
         `👷 Workforce: ${totalWorkforce}`;
}

function getWeatherEmoji(weather: string | null): string {
  if (!weather) return '🌤️';
  const w = weather.toLowerCase();
  if (w.includes('rain') || w.includes('drizzle')) return '🌧️';
  if (w.includes('cloud') || w.includes('overcast')) return '☁️';
  if (w.includes('sun') || w.includes('clear')) return '☀️';
  if (w.includes('storm') || w.includes('thunder')) return '⛈️';
  if (w.includes('snow')) return '🌨️';
  if (w.includes('fog') || w.includes('mist')) return '🌫️';
  if (w.includes('wind')) return '💨';
  return '🌤️';
}
