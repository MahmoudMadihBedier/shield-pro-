-- Shield Pro — tiered approval engine + fraud scan as RPCs.
-- Replaces the Appwrite `shield-server` routes evaluate-approval / fraud-scan.
--
-- These two re-express the pure logic that lives (and is unit-tested) in
-- src/core/approval.ts and src/core/fraud.ts. Those TS modules remain the
-- specification and are still used client-side for pre-checks; the copies here
-- are the server-side enforcement. Keep them in lockstep.

set check_function_bodies = off;

-- ----- evaluate_approval ---------------------------------------------
-- p_payload: { movementType, entityRef, context: {
--   amount?, qty?, repAverageQty?, recentSameActorItemCount?,
--   isNewCustomer?, overCreditLimit?, isPriceOverride? } }
-- Idempotent per entityRef: a second call replays the existing request.
create or replace function public.evaluate_approval(p_payload jsonb)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_mtype text := btrim(coalesce(p_payload->>'movementType', ''));
  v_ref   text := btrim(coalesce(p_payload->>'entityRef', ''));
  v_ctx   jsonb := coalesce(p_payload->'context', '{}'::jsonb);
  v_caller text := auth.uid()::text;

  v_is_new   boolean := coalesce((v_ctx->>'isNewCustomer')::boolean, false);
  v_over_cl  boolean := coalesce((v_ctx->>'overCreditLimit')::boolean, false);
  v_price_ov boolean := coalesce((v_ctx->>'isPriceOverride')::boolean, false);
  v_qty      numeric := nullif(v_ctx->>'qty', '')::numeric;
  v_rep_avg  numeric := nullif(v_ctx->>'repAverageQty', '')::numeric;
  v_repeat   numeric := nullif(v_ctx->>'recentSameActorItemCount', '')::numeric;

  r record;
  pred jsonb;
  p_new boolean; p_over boolean; p_price boolean;
  p_max_repeat numeric; p_max_qty_mult numeric;
  v_matched boolean; v_forces boolean;

  v_action text := 'force_manual';   -- fail-safe default
  v_rule_id text := null;
  v_existing public.approval_requests%rowtype;
  v_request_id text;
begin
  perform public._require_staff();
  if v_mtype = '' then raise exception 'movementType is required' using errcode = '22023'; end if;
  if v_ref = ''   then raise exception 'entityRef is required'   using errcode = '22023'; end if;

  -- Idempotency: replay an existing evaluation for this entity.
  select * into v_existing from public.approval_requests where entity_ref = v_ref limit 1;
  if found then
    return jsonb_build_object(
      'action', case when v_existing.state = 'auto_approved' then 'auto_approve' else 'force_manual' end,
      'ruleId', null,
      'approvalRequestId', v_existing.id);
  end if;

  for r in
    select id, predicate, action, coalesce(priority, 100) as priority
    from public.approval_rules
    where movement_type = v_mtype and coalesce(is_active, false)
    order by coalesce(priority, 100) asc, id asc
  loop
    begin
      pred := r.predicate::jsonb;
    exception when others then
      pred := '{}'::jsonb;
    end;

    p_new   := coalesce((pred->>'requireManualIfNewCustomer')::boolean, false);
    p_over  := coalesce((pred->>'requireManualIfOverCreditLimit')::boolean, false);
    p_price := coalesce((pred->>'requireManualIfPriceOverride')::boolean, false);
    p_max_repeat   := nullif(pred->>'maxRepeatCount', '')::numeric;
    p_max_qty_mult := nullif(pred->>'maxQtyMultipleOfRepAverage', '')::numeric;

    v_matched := false;
    v_forces  := false;

    if p_new and v_is_new then v_matched := true; v_forces := true; end if;
    if p_over and v_over_cl then v_matched := true; v_forces := true; end if;
    if p_price and v_price_ov then v_matched := true; v_forces := true; end if;
    if p_max_repeat is not null and v_repeat is not null and v_repeat > p_max_repeat then
      v_matched := true; v_forces := true;
    end if;
    if not v_forces
       and p_max_qty_mult is not null and v_qty is not null
       and v_rep_avg is not null and v_rep_avg > 0
       and v_qty <= p_max_qty_mult * v_rep_avg then
      v_matched := true;
    end if;

    if v_matched then
      v_action  := case when v_forces then 'force_manual' else r.action end;
      v_rule_id := r.id;
      exit;
    end if;
  end loop;

  insert into public.approval_rule_log
    (id, movement_type, entity_ref, actor_id, rule_matched, outcome, created_at)
  values (gen_random_uuid()::text, v_mtype, v_ref, v_caller,
          coalesce(v_rule_id, ''), v_action, now());

  insert into public.approval_requests
    (id, entity_type, entity_ref, branch_id, requested_by, state, created_at)
  values (gen_random_uuid()::text, v_mtype, v_ref, null, v_caller,
          case when v_action = 'auto_approve' then 'auto_approved' else 'pending' end, now())
  returning id into v_request_id;

  if v_action = 'force_manual' then
    begin
      perform public._notify_system_admins(
        'approval_pending',
        'طلب موافقة بانتظار المراجعة: ' || v_mtype,
        'الحركة ' || v_ref || ' تتطلب مراجعة يدوية قبل الاعتماد.',
        v_ref);
    exception when others then
      raise warning 'evaluate_approval: notify failed for %: %', v_ref, sqlerrm;
    end;
  end if;

  return jsonb_build_object('action', v_action, 'ruleId', v_rule_id,
                            'approvalRequestId', v_request_id);
end;
$$;

-- ----- fraud_scan -----------------------------------------------------
-- Runs the three heuristics from src/core/fraud.ts over a recent window of
-- stock_ledger_entries + audit_log and appends new fraud_flags rows.
create or replace function public.fraud_scan(p_lookback_hours numeric default 24)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_hours numeric := coalesce(p_lookback_hours, 24);
  v_start timestamptz;
  v_moves int;
  v_audit int;
  v_candidates jsonb := '[]'::jsonb;
  c jsonb;
  v_created jsonb := '[]'::jsonb;
  v_created_n int := 0;
begin
  perform public._require_staff();
  if v_hours <= 0 then
    raise exception 'lookbackHours must be a positive number' using errcode = '22023';
  end if;
  if v_hours > 168 then
    raise exception 'lookbackHours cannot exceed 168 (7 days)' using errcode = '22023';
  end if;
  v_start := now() - make_interval(secs => v_hours * 3600);

  select count(*) into v_moves from public.stock_ledger_entries where posting_datetime >= v_start;
  select count(*) into v_audit from public.audit_log where created_at >= v_start;

  -- round_tripping: opposite-sign, near-equal magnitude moves for one
  -- product+warehouse via two different vouchers, inside the window.
  with sle as (
    select product_id, warehouse_id, voucher_no, qty_change, posting_datetime
    from public.stock_ledger_entries where posting_datetime >= v_start
  ),
  pairs as (
    select distinct on (a.product_id, a.warehouse_id)
      a.product_id, a.warehouse_id, a.voucher_no av, b.voucher_no bv,
      a.qty_change aq, b.qty_change bq, a.posting_datetime ad, b.posting_datetime bd
    from sle a
    join sle b
      on a.product_id = b.product_id and a.warehouse_id = b.warehouse_id
     and a.voucher_no <> b.voucher_no
     and sign(a.qty_change) <> 0 and sign(a.qty_change) = -sign(b.qty_change)
     and a.posting_datetime <= b.posting_datetime
     and extract(epoch from (b.posting_datetime - a.posting_datetime)) <= v_hours * 3600
     and abs(abs(a.qty_change) - abs(b.qty_change))
         / greatest(abs(a.qty_change), abs(b.qty_change)) <= 0.01
    order by a.product_id, a.warehouse_id, a.posting_datetime, b.posting_datetime
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', 'round_tripping', 'subjectType', 'product_warehouse',
    'subjectId', product_id || ':' || warehouse_id,
    'detail', 'stock round-tripped for "' || product_id || ':' || warehouse_id
      || '": voucher ' || av || ' moved ' || aq || ' at ' || ad
      || ', voucher ' || bv || ' moved ' || bq || ' at ' || bd
  )), '[]'::jsonb)
  into v_candidates
  from pairs;

  -- repeated_movement: > 5 distinct vouchers touch one product+warehouse
  -- within the window (which is exactly the fetch window, so a simple count).
  v_candidates := v_candidates || (
    select coalesce(jsonb_agg(jsonb_build_object(
      'kind', 'repeated_movement', 'subjectType', 'product_warehouse',
      'subjectId', product_id || ':' || warehouse_id,
      'detail', n || ' distinct vouchers moved "' || product_id || ':' || warehouse_id
        || '" within a ' || v_hours || 'h window (limit 5)'
    )), '[]'::jsonb)
    from (
      select product_id, warehouse_id, count(distinct voucher_no) n
      from public.stock_ledger_entries
      where posting_datetime >= v_start
      group by product_id, warehouse_id
      having count(distinct voucher_no) > 5
    ) g
  );

  -- high_reversal_ratio: one actor cancels > 20% of >= 5 submissions.
  v_candidates := v_candidates || (
    select coalesce(jsonb_agg(jsonb_build_object(
      'kind', 'high_reversal_ratio', 'subjectType', 'actor', 'subjectId', actor_id,
      'detail', cancelled || ' of ' || submitted || ' submissions were cancelled ('
        || round(100.0 * cancelled / submitted, 1) || '%), above the 20% threshold'
    )), '[]'::jsonb)
    from (
      select actor_id,
        count(*) filter (where action = 'submit') submitted,
        count(*) filter (where action = 'cancel') cancelled
      from public.audit_log
      where created_at >= v_start and action in ('submit', 'cancel') and actor_id <> ''
      group by actor_id
    ) a
    where submitted >= 5 and cancelled::numeric / submitted > 0.2
  );

  -- dedupe against open flags, insert survivors, notify per flag.
  for c in select value from jsonb_array_elements(v_candidates) loop
    if exists (
      select 1 from public.fraud_flags
      where status = 'open' and kind = (c->>'kind') and subject_id = (c->>'subjectId')
    ) then
      continue;
    end if;

    insert into public.fraud_flags
      (id, kind, subject_type, subject_id, detail, status, created_at)
    values (gen_random_uuid()::text, c->>'kind', left(c->>'subjectType', 32),
            left(c->>'subjectId', 36), left(c->>'detail', 2000), 'open', now());

    begin
      perform public._notify_system_admins(
        'fraud_flag', 'بلاغ احتيال جديد: ' || (c->>'kind'), c->>'detail', c->>'subjectId');
    exception when others then
      raise warning 'fraud_scan: notify failed for %: %', c->>'subjectId', sqlerrm;
    end;

    v_created := v_created || c;
    v_created_n := v_created_n + 1;
  end loop;

  perform public._audit('fraud_scan', 'fraud_flags',
    'scan-' || to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS'),
    null, jsonb_build_object('created', v_created_n));

  return jsonb_build_object(
    'scanned', jsonb_build_object('moves', v_moves, 'auditEvents', v_audit),
    'flagsCreated', v_created_n,
    'flags', v_created);
end;
$$;

grant execute on function public.evaluate_approval(jsonb) to authenticated;
grant execute on function public.fraud_scan(numeric) to authenticated;
