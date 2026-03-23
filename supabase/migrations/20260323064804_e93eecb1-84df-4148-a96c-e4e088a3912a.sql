create or replace function public.stock_audit_summary(
  p_company_id uuid default null
)
returns table(
  id uuid,
  item_code text,
  name text,
  current_stock numeric,
  bin_total numeric,
  bin_count int,
  variance numeric,
  status text
)
language sql stable
security invoker
set search_path = public
as $$
  select
    wi.id,
    wi.item_code,
    wi.name,
    coalesce(wi.current_stock, 0) as current_stock,
    coalesce(sum(wba.allocated_quantity), 0) as bin_total,
    count(wba.id)::int as bin_count,
    coalesce(wi.current_stock, 0) - coalesce(sum(wba.allocated_quantity), 0) as variance,
    case
      when count(wba.id) = 0 and coalesce(wi.current_stock, 0) = 0 then 'ok'
      when count(wba.id) = 0 then 'no_bins'
      when abs(coalesce(wi.current_stock, 0) - coalesce(sum(wba.allocated_quantity), 0)) < 0.001 then 'ok'
      else 'desync'
    end as status
  from warehouse_items wi
  left join warehouse_bin_allocations wba
    on wba.warehouse_item_id = wi.id
    and (p_company_id is null or wba.company_id = p_company_id)
  where wi.status = 'active'
    and (p_company_id is null or wi.company_id = p_company_id)
  group by wi.id, wi.item_code, wi.name, wi.current_stock
$$;