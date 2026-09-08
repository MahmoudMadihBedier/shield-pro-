-- Never let the business end up with zero active System Admins. This is the
-- authoritative, atomic guard (a `BEFORE` trigger inside the same transaction as
-- the write) — the `staff-account` Edge Function's pre-check is only a friendly
-- early error. Covers profile edits (role change / deactivation) and deletes.

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
begin
  -- did the OLD row count as an active System Admin?
  v_was_admin := coalesce(old.is_active, true)
    and (' ' || coalesce(old.roles, '') || ' ') ~ '[[:space:],]system_admin([[:space:],]|$)';

  if not v_was_admin then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    v_still_admin := false;
  else
    v_still_admin := coalesce(new.is_active, true)
      and (' ' || coalesce(new.roles, '') || ' ') ~ '[[:space:],]system_admin([[:space:],]|$)';
  end if;

  -- still an admin after the change → nothing to check
  if v_still_admin then
    return new;
  end if;

  select count(*) into v_others
  from public.users u
  where u.id <> old.id
    and coalesce(u.is_active, true)
    and (' ' || coalesce(u.roles, '') || ' ') ~ '[[:space:],]system_admin([[:space:],]|$)';

  if v_others = 0 then
    raise exception 'at least one active System Admin must remain'
      using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_enforce_active_system_admin on public.users;
create trigger trg_enforce_active_system_admin
  before update or delete on public.users
  for each row execute function public.enforce_active_system_admin();
