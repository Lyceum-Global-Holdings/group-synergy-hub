// Telegram Scheduled Jobs Dispatcher
// Invoked by pg_cron every 15 min (no body) OR manually by admin UI ({ job_id, dry_run?, triggered_by? }).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  html: string;
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

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || isNaN(Number(n))) return '0';
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

// ---------- Renderers ----------
async function renderWarehouseStockDaily(sb: SupabaseClient, job: Job): Promise<RenderedReport> {
  const { from, to, label } = previousLocalDay(job.timezone);
  // Movements grouped by warehouse location
  const { data: txs, error } = await sb
    .from('stock_transactions')
    .select('id, transaction_type, quantity_change, total_value, location_id, item_id, created_at')
    .eq('company_id', job.company_id)
    .gte('created_at', from)
    .lt('created_at', to);
  if (error) throw error;

  const { data: locs } = await sb
    .from('warehouse_locations')
    .select('id, name, location_type')
    .eq('company_id', job.company_id);
  const locMap = new Map((locs ?? []).map((l: any) => [l.id, l.name]));

  type Bucket = { in: number; out: number; adj: number; tIn: number; tOut: number; count: number };
  const byLoc = new Map<string, Bucket>();
  for (const t of (txs ?? []) as any[]) {
    const key = t.location_id ?? 'unassigned';
    const b = byLoc.get(key) ?? { in: 0, out: 0, adj: 0, tIn: 0, tOut: 0, count: 0 };
    b.count++;
    const q = Number(t.quantity_change) || 0;
    switch (t.transaction_type) {
      case 'goods_receipt': b.in += q; break;
      case 'material_issue':
      case 'project_issue': b.out += Math.abs(q); break;
      case 'material_return':
      case 'project_return': b.in += q; break;
      case 'adjustment': b.adj += q; break;
      case 'transfer_in': b.tIn += q; break;
      case 'transfer_out': b.tOut += Math.abs(q); break;
    }
    byLoc.set(key, b);
  }

  let html = `<b>📦 Daily Warehouse Stock Report</b>\n<i>Date: ${esc(label)}</i>\n\n`;
  if (byLoc.size === 0) {
    html += '<i>No stock movements recorded.</i>';
  } else {
    for (const [locId, b] of byLoc) {
      html += `<b>${esc(locMap.get(locId) ?? 'Unassigned')}</b>\n`;
      html += `  Movements: ${b.count}\n`;
      html += `  Receipts: +${fmtNum(b.in)} | Issues: -${fmtNum(b.out)}\n`;
      html += `  Transfers: +${fmtNum(b.tIn)} / -${fmtNum(b.tOut)}\n`;
      html += `  Adjustments: ${b.adj >= 0 ? '+' : ''}${fmtNum(b.adj)}\n\n`;
    }
  }

  // Closing balance summary (top 10 by value)
  const { data: bal } = await sb
    .from('warehouse_items')
    .select('id, current_stock, unit_cost')
    .eq('company_id', job.company_id)
    .gt('current_stock', 0)
    .order('current_stock', { ascending: false })
    .limit(10);

  const totalValue = (bal ?? []).reduce(
    (s: number, r: any) => s + (Number(r.current_stock) || 0) * (Number(r.unit_cost) || 0),
    0,
  );
  html += `<b>Closing Balance Snapshot</b>\n`;
  html += `Tracked SKUs in stock: ${(bal ?? []).length}+\n`;
  html += `Top-10 inventory value: ${fmtNum(totalValue)}\n`;

  return { title: 'Daily Warehouse Stock Report', html };
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
        await sendTelegram(botToken, chatId, messageText);
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

    return { ok: status !== 'failed', preview: messageText.slice(0, 500) };
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
