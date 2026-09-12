-- CRM follow-ups → notification center (docs/CRM_PLAN.md Phase A #2).
--
-- No scheduled job (pg_cron/Edge Function) is set up yet, so this is the
-- "check on read" approach the plan named as the cheap option: a caller-
-- scoped, idempotent sync the client fires once per app load (see
-- `shared/notifications/useNotifications.ts`). It only ever touches the
-- CALLER's own overdue, still-open follow-ups, and never re-notifies for the
-- same one twice (guarded by a NOT EXISTS on kind + entity_ref).
--
-- `notifications` has no client INSERT policy at all (see 0001) — this
-- SECURITY DEFINER function is the only way a follow-up notification can be
-- created, matching `_notify_system_admins` (0003).

set check_function_bodies = off;

create or replace function public.sync_overdue_followup_notifications() returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_count int := 0;
  r record;
begin
  if auth.uid() is null then
    raise exception 'a signed-in caller is required' using errcode = '42501';
  end if;

  for r in
    select f.id, f.title, f.due_date
    from public.crm_followups f
    where f.assigned_to = auth.uid()::text
      and f.status = 'open'
      and f.due_date < current_date
      and not exists (
        select 1 from public.notifications n
        where n.recipient_user_id = auth.uid()::text
          and n.kind = 'overdue_followup'
          and n.entity_ref = f.id
      )
  loop
    insert into public.notifications
      (id, recipient_user_id, kind, title, body, entity_ref, is_read, created_at)
    values (
      gen_random_uuid()::text,
      auth.uid()::text,
      'overdue_followup',
      left('متابعة متأخرة: ' || r.title, 200),
      'كانت مستحقة بتاريخ ' || to_char(r.due_date, 'YYYY-MM-DD'),
      r.id,
      false,
      now()
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.sync_overdue_followup_notifications() from public;
grant execute on function public.sync_overdue_followup_notifications() to authenticated;
