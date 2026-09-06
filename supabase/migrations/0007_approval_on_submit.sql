-- Story 2.2 finish — wire the tiered approval engine into document submission.
--
-- Before: evaluate_approval was a standalone RPC nothing called; submit_document
-- flipped doc_status → 1 with no approval check.
-- After:
--   * evaluate_approval enriches the rule context from the document row itself
--     (branch, new-customer, over-credit-limit, amount), and — crucially —
--     returns `auto_approve` for a movement type that has NO active rules
--     (ungoverned = automatic; the fail-safe-to-manual now only applies WITHIN a
--     governed movement type where no rule matched). Replay of an already
--     approved/auto_approved request also returns `auto_approve`.
--   * submit_document refuses to submit while a governed document has no
--     approved/auto_approved approval_requests row (`_approval_cleared`).
--
-- Client flow (src/shared/documents/document-repo.ts): submit() calls
-- evaluate_approval first; `force_manual` → the draft stays a draft and the
-- caller gets a `pending_approval` AppError; an admin clears it from the
-- Exceptions dashboard (decide_approval), then a re-submit replays as
-- auto_approve and proceeds.

set check_function_bodies = off;

-- ----- evaluate_approval (v2) ------------------------------------------
create or replace function public.evaluate_approval(p_payload jsonb)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_mtype text := btrim(coalesce(p_payload->>'movementType', ''));
  v_ref   text := btrim(coalesce(p_payload->>'entityRef', ''));
  v_ctx   jsonb := coalesce(p_payload->'context', '{}'::jsonb);
  v_caller text := auth.uid()::text;

  -- context, seeded from the client and enriched from the document row below
  v_is_new   boolean;
  v_over_cl  boolean;
  v_price_ov boolean := coalesce((v_ctx->>'isPriceOverride')::boolean, false);
  v_qty      numeric := nullif(v_ctx->>'qty', '')::numeric;
  v_rep_avg  numeric := nullif(v_ctx->>'repAverageQty', '')::numeric;
  v_repeat   numeric := nullif(v_ctx->>'recentSameActorItemCount', '')::numeric;
  v_amount   numeric := nullif(v_ctx->>'amount', '')::numeric;
  v_branch   text := null;

  v_row jsonb;
  v_customer text;
  v_credit_limit numeric;
  v_outstanding numeric;

  v_rule_count int;
  r record;
  pred jsonb;
  p_new boolean; p_over boolean; p_price boolean;
  p_max_repeat numeric; p_max_qty_mult numeric;
  v_matched boolean; v_forces boolean;

  v_action text := 'force_manual';   -- fail-safe within a governed movement type
  v_rule_id text := null;
  v_existing public.approval_requests%rowtype;
  v_request_id text;
begin
  perform public._require_staff();
  if v_mtype = '' then raise exception 'movementType is required' using errcode = '22023'; end if;
  if v_ref = ''   then raise exception 'entityRef is required'   using errcode = '22023'; end if;

  -- Idempotency: replay an existing evaluation for this entity. An
  -- approved/auto_approved request replays as auto_approve so a re-submit
  -- after a manual approval can proceed; pending/rejected stay manual.
  select * into v_existing from public.approval_requests where entity_ref = v_ref limit 1;
  if found then
    return jsonb_build_object(
      'action', case when v_existing.state in ('approved', 'auto_approved')
                     then 'auto_approve' else 'force_manual' end,
      'ruleId', null,
      'approvalRequestId', v_existing.id);
  end if;

  -- Enrich the context from the document row (submittable tables only).
  if public._is_submittable(v_mtype) then
    execute format('select to_jsonb(t) from public.%I t where t.reference_id = $1', v_mtype)
      into v_row using v_ref;
    if v_row is not null then
      v_branch   := nullif(v_row->>'branch_id', '');
      v_customer := nullif(v_row->>'customer_id', '');
      if v_amount is null then
        v_amount := nullif(coalesce(
          v_row->>'net_total', v_row->>'grand_total', v_row->>'amount', v_row->>'total'), '')::numeric;
      end if;
      if v_customer is not null then
        select (approval_state = 'pending_approval'), credit_limit
          into v_is_new, v_credit_limit
          from public.customers where id = v_customer;
        if v_credit_limit is not null and v_credit_limit > 0 and coalesce(v_amount, 0) > 0 then
          select coalesce(sum(net_total), 0) into v_outstanding
            from public.sales_invoices
            where customer_id = v_customer and doc_status = 1;
          v_over_cl := (v_outstanding + v_amount) > v_credit_limit;
        end if;
      end if;
    end if;
  end if;

  -- client-supplied values win where explicitly provided
  v_is_new  := coalesce((v_ctx->>'isNewCustomer')::boolean, v_is_new, false);
  v_over_cl := coalesce((v_ctx->>'overCreditLimit')::boolean, v_over_cl, false);

  -- An ungoverned movement type (no active rules) auto-approves.
  select count(*) into v_rule_count
    from public.approval_rules where movement_type = v_mtype and coalesce(is_active, false);
  if v_rule_count = 0 then
    v_action := 'auto_approve';
  else
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
  end if;

  insert into public.approval_rule_log
    (id, movement_type, entity_ref, actor_id, rule_matched, outcome, created_at)
  values (gen_random_uuid()::text, v_mtype, v_ref, v_caller,
          coalesce(v_rule_id, ''), v_action, now());

  insert into public.approval_requests
    (id, entity_type, entity_ref, branch_id, requested_by, state, created_at)
  values (gen_random_uuid()::text, v_mtype, v_ref, v_branch, v_caller,
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

-- ----- _approval_cleared --------------------------------------------
-- True when the document may be submitted: either its movement type has no
-- active rules at all, or an approved/auto_approved request exists for its ref.
create or replace function public._approval_cleared(p_table text, p_entity_ref text)
  returns boolean
  language sql stable security definer set search_path = public as $$
  select
    not exists (
      select 1 from public.approval_rules
      where movement_type = p_table and coalesce(is_active, false)
    )
    or exists (
      select 1 from public.approval_requests
      where entity_ref = p_entity_ref and state in ('approved', 'auto_approved')
    );
$$;

-- ----- submit_document (v2 — approval gate added) ---------------------
create or replace function public.submit_document(p_table text, p_row_id text)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  posting timestamptz := now();
  ref text;
begin
  if auth.uid() is null then
    raise exception 'a signed-in caller is required to submit' using errcode = '42501';
  end if;
  if not public._is_submittable(p_table) then
    raise exception '"%" is not a submittable document table', p_table using errcode = '22023';
  end if;

  execute format('select to_jsonb(t) from public.%I t where t.id = $1', p_table)
    into r using p_row_id;
  if r is null then
    raise exception '%/% does not exist', p_table, p_row_id using errcode = 'P0002';
  end if;

  if (r->>'doc_status')::int <> 0 then
    raise exception 'document is %', case (r->>'doc_status')::int when 1 then 'already submitted' else 'cancelled' end
      using errcode = '55000';
  end if;
  if not public._can_submit(p_table) then
    raise exception 'your role may not submit this document type' using errcode = '42501';
  end if;
  if not public._can_act_on_branch(r->>'branch_id') then
    raise exception 'this document belongs to another branch' using errcode = '42501';
  end if;
  perform public._assert_no_self_approval(r);

  if not public._approval_cleared(p_table, r->>'reference_id') then
    if exists (select 1 from public.approval_requests
               where entity_ref = r->>'reference_id' and state = 'rejected') then
      raise exception 'this submission was rejected in approval review' using errcode = '42501';
    end if;
    raise exception 'this document is awaiting approval review and cannot be submitted yet'
      using errcode = '55000';
  end if;

  execute format(
    'update public.%I set doc_status = 1, posting_datetime = $1 where id = $2', p_table
  ) using posting, p_row_id;

  ref := r->>'reference_id';
  perform public._audit('submit', p_table, ref,
    jsonb_build_object('doc_status', 0),
    jsonb_build_object('doc_status', 1, 'posting_datetime', posting, 'actorRoles', public.user_roles()));

  return jsonb_build_object('table', p_table, 'rowId', p_row_id, 'referenceId', ref,
                            'docStatus', 1, 'postingDatetime', posting);
end;
$$;

grant execute on function public.evaluate_approval(jsonb) to authenticated;
grant execute on function public._approval_cleared(text, text) to authenticated;
grant execute on function public.submit_document(text, text) to authenticated;
