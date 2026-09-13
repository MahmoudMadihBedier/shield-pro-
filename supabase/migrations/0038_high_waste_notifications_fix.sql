-- Fixes to 0037_high_waste_notifications.sql, both caught by /code-review:
--
-- 1. `round(double precision, integer)` has no Postgres overload — only
--    `round(numeric, integer)`. `produced_qty`/`waste_qty` are `float`
--    columns (double precision), so the un-cast ratio expression raised
--    "function round(double precision, integer) does not exist" the first
--    time a real batch crossed the waste threshold, aborting the whole
--    function call with no exception handler — every notification in that
--    call was lost, and the client swallows the failure as a best-effort
--    background sync, so the feature would have silently never fired. Same
--    gotcha already worked around in 0028_portal_statement_rpc.sql
--    (`round(si.net_total::numeric, 2)`) — fixed here the same way, casting
--    the ratio to `numeric` before rounding.
-- 2. Missing the explicit `revoke ... / grant ... to authenticated` pair that
--    0035_overdue_followup_notifications.sql (this function's own cited
--    precedent) uses for the same kind of caller-facing RPC — added, on
--    Postgres's default EXECUTE-to-PUBLIC grant otherwise.
set check_function_bodies = off;

create or replace function public.sync_high_waste_notifications() returns integer
  language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  r record;
begin
  if auth.uid() is null then
    raise exception 'a signed-in caller is required' using errcode = '42501';
  end if;

  if not (
    public.has_role('factory_manager')
    or public.has_role('factory_accountant')
    or public.has_role('system_admin')
  ) then
    return 0;
  end if;

  for r in
    select b.id, b.reference_id, b.produced_qty, b.waste_qty,
           p.name as product_name, p.allowed_waste_pct
    from public.production_batches b
    join public.products p on p.id = b.product_id
    where b.doc_status = 1
      and (b.produced_qty + b.waste_qty) > 0
      and (b.waste_qty::numeric / (b.produced_qty + b.waste_qty)::numeric)
          > (p.allowed_waste_pct / 100.0)
      and public._can_read_branch(b.branch_id)
      and not exists (
        select 1 from public.notifications n
        where n.recipient_user_id = auth.uid()::text
          and n.kind = 'high_waste'
          and n.entity_ref = b.id
      )
  loop
    insert into public.notifications
      (id, recipient_user_id, kind, title, body, entity_ref, is_read, created_at)
    values (
      gen_random_uuid()::text, auth.uid()::text, 'high_waste',
      left('نسبة هدر مرتفعة: ' || r.product_name || ' (' || r.reference_id || ')', 200),
      left(
        'الهدر ' || round(
          (100.0 * r.waste_qty::numeric / (r.produced_qty + r.waste_qty)::numeric), 1
        ) || '% يتجاوز المسموح به ' || r.allowed_waste_pct || '%',
        2000
      ),
      r.id, false, now()
    )
    on conflict (recipient_user_id, entity_ref) where kind = 'high_waste' do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.sync_high_waste_notifications() from public;
grant execute on function public.sync_high_waste_notifications() to authenticated;
