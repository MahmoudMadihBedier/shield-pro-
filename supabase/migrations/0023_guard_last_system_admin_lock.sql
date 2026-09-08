-- Harden the last-System-Admin guard against concurrent demotions. The 0022
-- version counted other active admins with a plain SELECT, which under READ
-- COMMITTED lets two transactions each demote one of the last two admins (each
-- sees the other as still active) and leave zero. Lock the other active-admin
-- rows FOR UPDATE so the second transaction blocks, then re-evaluates against
-- the first one's committed state.

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

  -- Serialise concurrent demotions: lock the other active-admin rows. A second
  -- transaction demoting one of them waits here, then the count below reflects
  -- this transaction's committed change.
  select count(*) into v_others
  from (
    select u.id
    from public.users u
    where u.id <> old.id
      and coalesce(u.is_active, true)
      and (' ' || coalesce(u.roles, '') || ' ') ~ v_rx
    for update
  ) locked;

  if v_others = 0 then
    raise exception 'at least one active System Admin must remain'
      using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
