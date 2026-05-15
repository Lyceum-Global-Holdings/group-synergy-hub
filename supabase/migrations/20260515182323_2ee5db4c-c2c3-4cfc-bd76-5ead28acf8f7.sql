
create or replace function public.get_location_with_ancestors(p_location_id uuid)
returns table(location_id uuid)
language sql stable security invoker set search_path = public as $$
  with recursive chain as (
    select id, parent_id from public.warehouse_locations where id = p_location_id
    union all
    select wl.id, wl.parent_id
    from public.warehouse_locations wl
    join chain c on wl.id = c.parent_id
  )
  select id from chain;
$$;

create or replace function public.list_bins_for_location_inherited(p_location_id uuid)
returns table(
  id uuid,
  bin_code text,
  name text,
  bin_type_id uuid,
  location_id uuid,
  inherited_from_location_id uuid,
  inherited_from_location_name text,
  status text,
  capacity numeric,
  current_quantity numeric,
  is_global_template boolean,
  company_id uuid
)
language sql stable security invoker set search_path = public as $$
  with anc as (
    select location_id as lid from public.get_location_with_ancestors(p_location_id)
  )
  select
    b.id,
    b.bin_code,
    b.name,
    b.bin_type_id,
    b.location_id,
    case when b.location_id <> p_location_id then b.location_id end as inherited_from_location_id,
    case when b.location_id <> p_location_id then wl.name end as inherited_from_location_name,
    b.status,
    b.capacity,
    b.current_quantity,
    b.is_global_template,
    b.company_id
  from public.warehouse_bins b
  join anc on anc.lid = b.location_id
  join public.warehouse_locations wl on wl.id = b.location_id
  order by (b.location_id <> p_location_id), b.bin_code;
$$;

grant execute on function public.get_location_with_ancestors(uuid) to authenticated;
grant execute on function public.list_bins_for_location_inherited(uuid) to authenticated;
