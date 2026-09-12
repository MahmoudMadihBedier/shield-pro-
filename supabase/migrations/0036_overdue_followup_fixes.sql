-- Code-review fixes on 0035 (overdue-follow-up notifications):
--
-- 1. The NOT EXISTS dedupe guard had no backing constraint — two concurrent
--    "check on read" calls (two tabs/devices) could both pass the check
--    before either INSERT commits, creating duplicate notifications for the
--    same follow-up. A partial unique index scoped to `kind =
--    'overdue_followup'` plus `ON CONFLICT DO NOTHING` closes it atomically.
--    Scoped to this one kind (not every kind) because the live table already
--    has legitimate repeat `fraud_flag` rows sharing an entity_ref — a
--    table-wide constraint would conflict with existing data and change that
--    unrelated flow's behavior, which is out of scope here.
-- 2. `current_date` is the DB session's UTC calendar day; the client's
--    `isOverdue()` (src/modules/crm/domain/followup.ts) compares against the
--    browser's LOCAL calendar day. Shield Pro is an Egypt-only business
--    (ar-EG / EGP throughout) — comparing in `Africa/Cairo` instead of UTC
--    makes the server's "overdue" agree with the UI's for every real user
--    instead of disagreeing for a few hours around UTC midnight every day.

set check_function_bodies = off;

create unique index if not exists "notifications_overdue_followup_dedupe_uq"
  on public."notifications" ("recipient_user_id", "entity_ref")
  where "kind" = 'overdue_followup';

create or replace function public.sync_overdue_followup_notifications() returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_count int := 0;
  v_today date := (now() at time zone 'Africa/Cairo')::date;
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
      and f.due_date < v_today
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
    )
    on conflict (recipient_user_id, entity_ref) where kind = 'overdue_followup'
    do nothing;
    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;
