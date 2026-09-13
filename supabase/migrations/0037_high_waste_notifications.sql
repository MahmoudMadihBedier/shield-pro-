-- High-waste production batch notifications (Plan §2.6 NotificationService,
-- the `high_waste` kind — already labelled client-side in
-- `src/shared/notifications/domain.ts` but never wired to a real writer).
--
-- Same "check on read" idempotent pattern as `sync_overdue_followup_notifications`
-- (0035/0036): a caller-scoped SECURITY DEFINER function, fired opportunistically
-- from a mounted component rather than a scheduled job, deduped via a partial
-- unique index on (recipient_user_id, entity_ref) scoped to this kind only —
-- the `notifications` table already carries legitimate duplicate rows for
-- `fraud_flag` under other (recipient, entity_ref) pairs, so a blanket
-- constraint would break that, same reasoning as 0036.
--
-- Recipient model: unlike `fraud_flag` (broadcast to every System Admin via
-- `_notify_system_admins`), this is self-scoped like the follow-up sync — each
-- caller who can see manufacturing data gets their own copy the next time they
-- trigger the check, deduped per (caller, batch). Simpler and lower-risk than a
-- true broadcast-to-role fan-out, and every factory role ends up notified once
-- they load a page that fires the check. Non-manufacturing callers short-circuit
-- to a no-op before touching `production_batches` at all.
set check_function_bodies = off;

create unique index if not exists "notifications_high_waste_dedupe_uq"
  on public."notifications" ("recipient_user_id", "entity_ref")
  where "kind" = 'high_waste';

create or replace function public.sync_high_waste_notifications() returns integer
  language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  r record;
begin
  if auth.uid() is null then
    raise exception 'a signed-in caller is required' using errcode = '42501';
  end if;

  -- Only factory-facing roles get this check; everyone else is a cheap no-op.
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
    where b.doc_status = 1 -- Submitted only: a Draft's figures aren't final yet.
      and (b.produced_qty + b.waste_qty) > 0
      and (b.waste_qty::numeric / (b.produced_qty + b.waste_qty)) > (p.allowed_waste_pct / 100.0)
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
        'الهدر ' || round(100.0 * r.waste_qty / (r.produced_qty + r.waste_qty), 1)
          || '% يتجاوز المسموح به ' || r.allowed_waste_pct || '%',
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
