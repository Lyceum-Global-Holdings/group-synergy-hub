// Telegram Scheduled Jobs Dispatcher
// Invoked by pg_cron every 15 min (no body) OR manually by admin UI ({ job_id, dry_run?, triggered_by? }).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildStockLedgerPdf, type LedgerInput, type LedgerItemSection, type LedgerLocationSection, type LedgerRow } from "../_shared/pdf/stockLedger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ReportType =
  | 'warehouse_stock_daily'
  | 'tool_management_daily'
  | 'site_report_daily'
  | 'stock_transfer_daily';

interface Job {
  id: string;
  company_id: string;
  name: string;
  report_type: ReportType;
  frequency: 'daily' | 'weekly' | 'monthly';
  send_time: string;
  timezone: string;
  weekday: number | null;
  day_of_month: number | null;
  filters: Record<string, unknown>;
  chat_ids: string[];
  is_enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
}

interface RenderedReport {
  title: string;
  html: string;          // caption (PDF) or full body (text mode)
  pdf?: Uint8Array;      // when filters.format === 'pdf'
  filename?: string;
}

// ---------- Telegram send ----------
async function sendTelegram(botToken: string, chatId: string, text: string): Promise<void> {
  // Chunk to 4000 chars
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 4000) {
    let cut = remaining.lastIndexOf('\n', 4000);
    if (cut < 2000) cut = 4000;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  chunks.push(remaining);

  for (const chunk of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Telegram error ${res.status}: ${body}`);
    }
    await new Promise(r => setTimeout(r, 1100)); // Telegram rate-limit
  }
}


async function sendTelegramDocument(botToken: string, chatId: string, pdf: Uint8Array, filename: string, caption: string): Promise<void> {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption.slice(0, 1024));
  form.append('parse_mode', 'HTML');
  form.append('document', new Blob([pdf], { type: 'application/pdf' }), filename);
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendDocument ${res.status}: ${body}`);
  }
  await new Promise(r => setTimeout(r, 1100));
}

// ---------- Date helpers ----------
function previousLocalDay(timezone: string): { from: string; to: string; label: string } {
  // Compute "yesterday" in the given tz as ISO start/end UTC
  const now = new Date();
  // Use Intl to extract Y-M-D in tz
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const today = `${get('year')}-${get('month')}-${get('day')}`;
  const todayDate = new Date(`${today}T00:00:00Z`);
  const yest = new Date(todayDate);
  yest.setUTCDate(yest.getUTCDate() - 1);
  const yYMD = yest.toISOString().slice(0, 10);
  // We treat the local day boundaries as UTC for query simplicity (acceptable for daily reports).
  return { from: `${yYMD}T00:00:00Z`, to: `${today}T00:00:00Z`, label: yYMD };
}

function periodForJob(job: Job): { from: string; to: string; label: string; labelFrom: string; labelTo: string } {
  const day = previousLocalDay(job.timezone);
  if (job.frequency === 'daily') {
    return { ...day, labelFrom: day.label, labelTo: day.label };
  }
  // For weekly: previous 7 days; monthly: previous 30 days (anchored to "yesterday")
  const days = job.frequency === 'weekly' ? 7 : 30;
  const toDate = new Date(day.to);
  const fromDate = new Date(toDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - days);
  const fromYMD = fromDate.toISOString().slice(0, 10);
  return {
    from: `${fromYMD}T00:00:00Z`,
    to: day.to,
    label: `${fromYMD} → ${day.label}`,
    labelFrom: fromYMD,
    labelTo: day.label,
  };
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || isNaN(Number(n))) return '0';
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

// ---------- Renderers ----------
const TX_TYPE_LABEL: Record<string, string> = {
  goods_receipt: 'GR',
  material_issue: 'ISSUE',
  project_issue: 'PROJ-ISSUE',
  material_return: 'RETURN',
  project_return: 'PROJ-RETURN',
  adjustment: 'ADJUST',
  transfer_in: 'TRF-IN',
  transfer_out: 'TRF-OUT',
  opening_balance: 'OPEN',
};

async function renderWarehouseStockDaily(sb: SupabaseClient, job: Job): Promise<RenderedReport> {
  const { from, to, label, labelFrom, labelTo } = periodForJob(job);
  const filters = (job.filters ?? {}) as { location_ids?: string[]; format?: 'pdf' | 'text'; currency?: string };
  const format = filters.format ?? 'pdf';
  const locationIds = Array.isArray(filters.location_ids) ? filters.location_ids.filter(Boolean) : [];

  // Movements in period
  let txQuery = sb
    .from('stock_transactions')
    .select('id, transaction_type, quantity_change, total_value, unit_cost, location_id, item_id, reference_id, reference_type, created_at')
    .eq('company_id', job.company_id)
    .gte('created_at', from)
    .lt('created_at', to)
    .order('created_at', { ascending: true });
  if (locationIds.length > 0) txQuery = txQuery.in('location_id', locationIds);
  const { data: txs, error } = await txQuery;
  if (error) throw error;

  // Locations
  let locQuery = sb.from('warehouse_locations').select('id, name').eq('company_id', job.company_id);
  if (locationIds.length > 0) locQuery = locQuery.in('id', locationIds);
  const { data: locs } = await locQuery;
  const locMap = new Map<string, string>((locs ?? []).map((l: any) => [l.id, l.name]));

  // Items referenced
  const itemIds = Array.from(new Set((txs ?? []).map((t: any) => t.item_id).filter(Boolean)));
  let itemMap = new Map<string, { code: string; name: string; uom: string }>();
  if (itemIds.length > 0) {
    const { data: items } = await sb
      .from('warehouse_items_full')
      .select('id, item_code, name, base_uom')
      .in('id', itemIds);
    itemMap = new Map((items ?? []).map((i: any) => [i.id, { code: i.item_code ?? '—', name: i.name ?? '—', uom: i.base_uom ?? '' }]));
  }

  // Company name
  const { data: company } = await sb.from('companies').select('name').eq('id', job.company_id).maybeSingle();
  const companyName = (company as any)?.name ?? 'Company';
  const currency = filters.currency ?? 'AED';

  // Group: location → item → rows (sorted)
  type Key = string;
  const groups = new Map<Key, { locationId: string; locationName: string; itemId: string; rows: any[] }>();
  for (const t of (txs ?? []) as any[]) {
    const locId = t.location_id ?? 'unassigned';
    const locName = locMap.get(locId) ?? 'Unassigned';
    const itemId = t.item_id ?? 'unknown';
    const k = `${locId}::${itemId}`;
    let g = groups.get(k);
    if (!g) { g = { locationId: locId, locationName: locName, itemId, rows: [] }; groups.set(k, g); }
    g.rows.push(t);
  }

  // Build sections
  const sectionsMap = new Map<string, LedgerLocationSection>();
  let grandIn = 0, grandOut = 0, grandNetValue = 0;
  for (const g of groups.values()) {
    const item = itemMap.get(g.itemId) ?? { code: g.itemId.slice(0, 8), name: 'Unknown item', uom: '' };

    let totalIn = 0, totalOut = 0;
    const ledgerRows: LedgerRow[] = g.rows.map((t: any) => {
      const q = Number(t.quantity_change) || 0;
      const isIn = q > 0;
      if (isIn) totalIn += q; else totalOut += Math.abs(q);
      const unitCost = Number(t.unit_cost) || 0;
      const value = Number(t.total_value) || Math.abs(q) * unitCost;
      return {
        date: t.created_at,
        docNo: t.reference_id ? String(t.reference_id).slice(0, 8) : '—',
        refType: TX_TYPE_LABEL[t.transaction_type] ?? t.transaction_type,
        description: t.reference_type ?? '',
        inQty: isIn ? q : 0,
        outQty: isIn ? 0 : Math.abs(q),
        uom: item.uom,
        unitCost,
        value,
      };
    });
    grandIn += totalIn;
    grandOut += totalOut;
    grandNetValue += ledgerRows.reduce((s, r) => s + (r.inQty ? r.value : -r.value), 0);

    const itemSection: LedgerItemSection = {
      itemCode: item.code,
      itemName: item.name,
      uom: item.uom,
      rows: ledgerRows,
      totalIn,
      totalOut,
    };

    let loc = sectionsMap.get(g.locationId);
    if (!loc) { loc = { locationName: g.locationName, items: [] }; sectionsMap.set(g.locationId, loc); }
    loc.items.push(itemSection);
  }

  // Caption (always)
  const itemCount = groups.size;
  const locCount = sectionsMap.size;
  const caption =
    `<b>📦 Stock Movement Ledger — ${esc(label)}</b>\n` +
    `Company: ${esc(companyName)}\n` +
    `Locations: ${locCount}${locationIds.length ? ` (filtered)` : ' (all)'}\n` +
    `Items moved: ${itemCount} | Receipts: ${fmtNum(grandIn)} | Issues: ${fmtNum(grandOut)}\n` +
    `Net movement value: ${esc(currency)} ${fmtNum(grandNetValue)}`;

  if (format === 'text' || itemCount === 0) {
    // Text fallback / no movements
    let html = caption + '\n\n';
    if (itemCount === 0) html += '<i>No stock movements recorded.</i>';
    else {
      for (const loc of sectionsMap.values()) {
        html += `\n<b>${esc(loc.locationName)}</b>\n`;
        for (const it of loc.items) {
          html += `  • ${esc(it.itemCode)} ${esc(it.itemName)}: in +${fmtNum(it.totalIn)} / out -${fmtNum(it.totalOut)}\n`;
        }
      }
    }
    return { title: 'Stock Movement Ledger', html };
  }

  // Build PDF
  const ledgerInput: LedgerInput = {
    companyName,
    periodFrom: labelFrom,
    periodTo: labelTo,
    generatedAt: new Date().toISOString(),
    currency,
    sections: Array.from(sectionsMap.values()),
    totals: { in: grandIn, out: grandOut, netValue: grandNetValue },
  };
  const pdf = await buildStockLedgerPdf(ledgerInput);
  const filename = `Stock-Movement-Ledger_${labelFrom}_to_${labelTo}.pdf`;
  return { title: 'Stock Movement Ledger', html: caption, pdf, filename };
}

async function renderToolManagementDaily(sb: SupabaseClient, job: Job): Promise<RenderedReport> {
  const { from, to, label } = previousLocalDay(job.timezone);

  const { data: issues } = await sb
    .from('tool_issues')
    .select('id, issue_number, issued_to_name, quantity_issued, quantity_returned, status, tool_name_snapshot, bin_id')
    .eq('company_id', job.company_id)
    .gte('issue_date', from)
    .lt('issue_date', to);

  const { data: returns } = await sb
    .from('tool_returns')
    .select('id, quantity_returned, created_at')
    .eq('company_id', job.company_id)
    .gte('created_at', from)
    .lt('created_at', to);

  const { data: outstanding } = await sb
    .from('tool_issues')
    .select('id, issue_number, issued_to_name, tool_name_snapshot, quantity_issued, quantity_returned, expected_return_date, status')
    .eq('company_id', job.company_id)
    .neq('status', 'returned')
    .lt('expected_return_date', to)
    .limit(50);

  const totalIssued = (issues ?? []).reduce((s, r: any) => s + Number(r.quantity_issued || 0), 0);
  const totalReturned = (returns ?? []).reduce((s, r: any) => s + Number(r.quantity_returned || 0), 0);

  let html = `<b>🔧 Daily Tool Management Report</b>\n<i>Date: ${esc(label)}</i>\n\n`;
  html += `<b>Today's Activity</b>\n`;
  html += `  Issues: ${(issues ?? []).length} (qty ${fmtNum(totalIssued)})\n`;
  html += `  Returns: ${(returns ?? []).length} (qty ${fmtNum(totalReturned)})\n\n`;
  html += `<b>Overdue Tools (${(outstanding ?? []).length})</b>\n`;
  for (const o of (outstanding ?? []).slice(0, 15) as any[]) {
    const open = Number(o.quantity_issued || 0) - Number(o.quantity_returned || 0);
    html += `  • ${esc(o.tool_name_snapshot ?? 'Tool')} → ${esc(o.issued_to_name)} (${fmtNum(open)}) due ${esc(o.expected_return_date)}\n`;
  }
  if ((outstanding ?? []).length > 15) html += `  …and ${(outstanding ?? []).length - 15} more\n`;

  return { title: 'Daily Tool Management Report', html };
}

async function renderStockTransferDaily(sb: SupabaseClient, job: Job): Promise<RenderedReport> {
  const { from, to, label } = previousLocalDay(job.timezone);

  // Transfers are tracked as stock_transactions with reference_type = 'transfer'
  const { data: txs } = await sb
    .from('stock_transactions')
    .select('id, transaction_type, quantity_change, location_id, issued_to_location_id, item_id, created_at')
    .eq('company_id', job.company_id)
    .eq('reference_type', 'transfer')
    .gte('created_at', from)
    .lt('created_at', to);

  const { data: locs } = await sb
    .from('warehouse_locations')
    .select('id, name')
    .eq('company_id', job.company_id);
  const locMap = new Map((locs ?? []).map((l: any) => [l.id, l.name]));

  type Pair = { out: number; in: number; count: number };
  const flow = new Map<string, Pair>();
  for (const t of (txs ?? []) as any[]) {
    if (t.transaction_type !== 'transfer_out') continue; // count each transfer once
    const fromName = locMap.get(t.location_id) ?? 'Unassigned';
    const toName = locMap.get(t.issued_to_location_id) ?? 'Unassigned';
    const key = `${fromName} → ${toName}`;
    const p = flow.get(key) ?? { out: 0, in: 0, count: 0 };
    p.count++;
    p.out += Math.abs(Number(t.quantity_change) || 0);
    flow.set(key, p);
  }

  let html = `<b>🔄 Daily Stock Transfer Report</b>\n<i>Date: ${esc(label)}</i>\n\n`;
  if (flow.size === 0) {
    html += '<i>No stock transfers recorded.</i>';
  } else {
    html += `Total transfer events: ${(txs ?? []).filter((t: any) => t.transaction_type === 'transfer_out').length}\n\n`;
    for (const [route, p] of flow) {
      html += `<b>${esc(route)}</b>\n  Transfers: ${p.count} | Qty: ${fmtNum(p.out)}\n`;
    }
  }
  return { title: 'Daily Stock Transfer Report', html };
}

async function renderSiteReportDaily(sb: SupabaseClient, job: Job): Promise<RenderedReport> {
  const { from, to, label } = previousLocalDay(job.timezone);
  const { data: reports } = await sb
    .from('daily_site_reports')
    .select('id, report_date, project_id, weather, total_manpower, work_progress_summary, projects:project_id(name)')
    .eq('company_id', job.company_id)
    .gte('report_date', from.slice(0, 10))
    .lt('report_date', to.slice(0, 10))
    .order('report_date', { ascending: false });

  let html = `<b>🏗️ Daily Site Report</b>\n<i>Date: ${esc(label)}</i>\n\n`;
  if (!reports || reports.length === 0) {
    html += '<i>No site reports submitted.</i>';
    return { title: 'Daily Site Report', html };
  }
  for (const r of reports as any[]) {
    html += `<b>${esc(r.projects?.name ?? 'Project')}</b>\n`;
    html += `  Weather: ${esc(r.weather ?? 'n/a')}\n`;
    html += `  Manpower: ${fmtNum(r.total_manpower)}\n`;
    if (r.work_progress_summary) {
      html += `  Progress: ${esc(String(r.work_progress_summary).slice(0, 200))}\n`;
    }
    html += `\n`;
  }
  return { title: 'Daily Site Report', html };
}

const RENDERERS: Record<ReportType, (sb: SupabaseClient, job: Job) => Promise<RenderedReport>> = {
  warehouse_stock_daily: renderWarehouseStockDaily,
  tool_management_daily: renderToolManagementDaily,
  site_report_daily: renderSiteReportDaily,
  stock_transfer_daily: renderStockTransferDaily,
};

// ---------- Run one job ----------
async function runJob(sb: SupabaseClient, job: Job, triggeredBy: 'cron' | 'manual' | 'test', dryRun = false): Promise<{ ok: boolean; preview?: string; error?: string }> {
  const { data: runRow, error: runErr } = await sb
    .from('telegram_job_runs')
    .insert({ job_id: job.id, company_id: job.company_id, triggered_by: triggeredBy, status: 'running' })
    .select('id')
    .single();
  if (runErr) console.error('Failed to create run row:', runErr);
  const runId = runRow?.id;

  try {
    const renderer = RENDERERS[job.report_type];
    if (!renderer) throw new Error(`Unknown report type: ${job.report_type}`);
    const report = await renderer(sb, job);
    const messageText = report.html;

    // Resolve recipients
    let chatIds = job.chat_ids ?? [];
    let botToken: string | null = null;
    const { data: settings } = await sb
      .from('telegram_settings')
      .select('bot_token, chat_id, is_enabled')
      .eq('company_id', job.company_id)
      .maybeSingle();
    botToken = settings?.bot_token ?? null;
    if (chatIds.length === 0 && settings?.chat_id) {
      chatIds = settings.chat_id.split(',').map((s: string) => s.trim()).filter(Boolean);
    }

    if (dryRun) {
      if (runId) await sb.from('telegram_job_runs').update({
        finished_at: new Date().toISOString(),
        status: 'success',
        recipient_count: 0,
        payload_preview: messageText.slice(0, 2000),
      }).eq('id', runId);
      return { ok: true, preview: messageText };
    }

    if (!botToken) throw new Error('No Telegram bot token configured for this company');
    if (chatIds.length === 0) throw new Error('No recipient chat IDs configured');
    if (!settings?.is_enabled) throw new Error('Telegram integration is disabled for this company');

    let okCount = 0;
    const errors: string[] = [];
    for (const chatId of chatIds) {
      try {
        if (report.pdf) {
          await sendTelegramDocument(botToken, chatId, report.pdf, report.filename ?? 'report.pdf', messageText);
        } else {
          await sendTelegram(botToken, chatId, messageText);
        }
        okCount++;
      } catch (e) {
        errors.push(`${chatId}: ${(e as Error).message}`);
      }
    }

    const status = okCount === chatIds.length ? 'success' : okCount === 0 ? 'failed' : 'partial';
    if (runId) await sb.from('telegram_job_runs').update({
      finished_at: new Date().toISOString(),
      status,
      recipient_count: okCount,
      error_text: errors.join('; ') || null,
      payload_preview: messageText.slice(0, 2000),
    }).eq('id', runId);

    // Update last_run_at (trigger recomputes next_run_at)
    if (triggeredBy !== 'test') {
      await sb.from('telegram_scheduled_jobs').update({ last_run_at: new Date().toISOString() }).eq('id', job.id);
    }

    return {
      ok: status !== 'failed',
      preview: messageText.slice(0, 500),
      error: errors.length ? errors.join('; ') : undefined,
      recipient_count: okCount,
      total_recipients: chatIds.length,
      status,
    };
  } catch (e) {
    const err = (e as Error).message;
    if (runId) await sb.from('telegram_job_runs').update({
      finished_at: new Date().toISOString(),
      status: 'failed',
      error_text: err,
    }).eq('id', runId);
    return { ok: false, error: err };
  }
}

// ---------- HTTP entry ----------
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(supabaseUrl, serviceKey);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body = cron */ }

  // Manual invocation
  if (body?.job_id) {
    // Require auth + admin role
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: cErr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (cErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claims.claims.sub as string;
    const { data: isAdmin } = await sb.rpc('is_admin', { _user_id: userId });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: job, error } = await sb
      .from('telegram_scheduled_jobs')
      .select('*')
      .eq('id', body.job_id)
      .single();
    if (error || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const result = await runJob(sb, job as Job, body.dry_run ? 'test' : 'manual', !!body.dry_run);
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // Cron dispatch: find due jobs
  const { data: jobs, error } = await sb
    .from('telegram_scheduled_jobs')
    .select('*')
    .eq('is_enabled', true)
    .lte('next_run_at', new Date().toISOString())
    .limit(50);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const results: any[] = [];
  for (const job of (jobs ?? []) as Job[]) {
    const r = await runJob(sb, job, 'cron');
    results.push({ job_id: job.id, name: job.name, ...r });
  }
  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
