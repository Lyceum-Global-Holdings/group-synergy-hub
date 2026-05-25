-- Uptime monitoring schema
create table if not exists public.uptime_checks (
  id uuid primary key default gen_random_uuid(),
  target text not null,
  url text not null,
  status_code int,
  latency_ms int,
  ok boolean not null,
  error text,
  checked_at timestamptz not null default now()
);

create index if not exists idx_uptime_checks_target_time
  on public.uptime_checks (target, checked_at desc);

create index if not exists idx_uptime_checks_checked_at
  on public.uptime_checks (checked_at desc);

alter table public.uptime_checks enable row level security;

-- Only admins/super_admins can read. No client writes; edge function uses service role.
drop policy if exists uptime_checks_select_admin on public.uptime_checks;
create policy uptime_checks_select_admin
  on public.uptime_checks for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin') or
    public.has_role(auth.uid(), 'super_admin')
  );

-- 30-day rollup view (per-target uptime % + latency percentiles)
create or replace view public.uptime_rollup_30d
with (security_invoker = true)
as
select
  target,
  max(url)                                                 as url,
  count(*)                                                 as checks,
  count(*) filter (where not ok)                           as failures,
  round(
    (count(*) filter (where ok))::numeric * 100.0
    / nullif(count(*), 0),
    3
  )                                                         as uptime_pct,
  percentile_cont(0.5) within group (order by latency_ms)  as p50_ms,
  percentile_cont(0.95) within group (order by latency_ms) as p95_ms,
  (array_agg(status_code order by checked_at desc))[1]     as last_status,
  (array_agg(ok          order by checked_at desc))[1]     as last_ok,
  max(checked_at)                                          as last_checked_at
from public.uptime_checks
where checked_at >= now() - interval '30 days'
group by target;

grant select on public.uptime_rollup_30d to authenticated;

-- Optional public status page link (super_admin managed via /admin/security)
alter table public.security_settings
  add column if not exists status_page_url text;