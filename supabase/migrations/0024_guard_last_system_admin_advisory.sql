-- 0023 locked the *other* admin rows FOR UPDATE, which serialises correctly but
-- can deadlock when two transactions demote different admins (each holds its own
-- row, each waits for the other). Replace the row-range lock with a single
-- transaction-scoped advisory lock taken only on the path that could drop the
-- last admin, so those rare writes queue instead of deadlocking.

set check_function_bodies = off;

create or replace function public.enforce_active_system_admin()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_was_admin boolean;
  v_still_admin boolean;
  v_others int;
  v_rx text := '[[:space:],]system_admin([[:space:],]|$)';
begin
  v_was_admin := coalesce(old.is_active, true)
    and (' ' || coalesce(old.roles, '') || ' ') ~ v_rx;

  if not v_was_admin then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    v_still_admin := false;
  else
    v_still_admin := coalesce(new.is_active, true)
      and (' ' || coalesce(new.roles, '') || ' ') ~ v_rx;
  end if;

  if v_still_admin then
    return new;
  end if;

  -- One lock for the whole "am I removing the last admin?" critical section.
  -- Held until the transaction ends; concurrent demotions block here in turn.
  perform pg_advisory_xact_lock(hashtext('enforce_active_system_admin'));

  select count(*) into v_others
  from public.users u
  where u.id <> old.id
    and coalesce(u.is_active, true)
    and (' ' || coalesce(u.roles, '') || ' ') ~ v_rx;

  if v_others = 0 then
    raise exception 'at least one active System Admin must remain'
      using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
