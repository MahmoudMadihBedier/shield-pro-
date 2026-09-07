-- Full-database export (Admin → "تصدير كل البيانات"). The read itself is plain
-- RLS-scoped SELECTs from the client, but a bulk export of every customer /
-- ledger / audit row is exactly the kind of event that must leave a trace, so
-- the client calls this after a successful export and it appends one row to
-- audit_log. System-Admin only.

set check_function_bodies = off;

create or replace function public.record_data_export(
  p_tables int,
  p_rows int,
  p_skipped int
) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform public._require_staff();
  if not public.has_role('system_admin') then
    raise exception 'only a System Admin may export the database' using errcode = '42501';
  end if;

  perform public._audit(
    'data_export',
    'database',
    'all',
    null,
    jsonb_build_object(
      'tables', coalesce(p_tables, 0),
      'rows', coalesce(p_rows, 0),
      'skipped', coalesce(p_skipped, 0)
    )
  );
end;
$$;
