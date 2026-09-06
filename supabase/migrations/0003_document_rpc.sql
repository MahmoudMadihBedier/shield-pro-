-- Shield Pro — ledger + approval + fraud-review write RPCs.
-- Replaces the Appwrite `shield-server` routes: post-stock-ledger, post-gl,
-- decide-approval, review-fraud-flag. All SECURITY DEFINER (they write
-- append-only ledgers and control tables that carry NO client write policy),
-- all atomic inside one statement's transaction, all append to audit_log.

set check_function_bodies = off;

-- ----- shared helpers ----------------------------------------------------

-- "staff" == has at least one recognised role slug in public.users.roles.
-- Mirrors functions/common/caller.ts::requireStaffCaller.
create or replace function public._require_staff() returns void
  language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'a signed-in caller is required' using errcode = '42501';
  end if;
  if array_length(public.user_roles(), 1) is null then
    raise exception 'this action is restricted to staff accounts' using errcode = '42501';
  end if;
end;
$$;

-- Fan a notification row out to every active System Admin. Best-effort:
-- notification failures must never roll back the decision that triggered them,
-- so callers wrap this in a sub-block that swallows exceptions.
create or replace function public._notify_system_admins(
  p_kind text, p_title text, p_body text, p_entity_ref text
) returns void
  language sql security definer set search_path = public as $$
  insert into public.notifications
    (id, recipient_user_id, kind, title, body, entity_ref, is_read, created_at)
  select gen_random_uuid()::text, u.auth_user_id, left(p_kind, 48), left(p_title, 200),
         left(p_body, 2000), left(p_entity_ref, 32), false, now()
  from public.users u
  where coalesce(u.is_active, true)
    and ('system_admin' = any(regexp_split_to_array(coalesce(u.roles, ''), '[\s,]+')));
$$;

-- ----- post_stock_ledger -------------------------------------------------
-- The ONLY writer of stock_ledger_entries + the bin_balances projection.
-- p_payload: { voucherType, voucherNo, postingDatetime, moves: [
--   { productId, warehouseId, lotNumber?, qtyChange, valuationRate? } ] }
create or replace function public.post_stock_ledger(p_payload jsonb)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_type text := btrim(coalesce(p_payload->>'voucherType', ''));
  v_no   text := btrim(coalesce(p_payload->>'voucherNo', ''));
  v_dt   text := btrim(coalesce(p_payload->>'postingDatetime', ''));
  v_moves jsonb := coalesce(p_payload->'moves', '[]'::jsonb);
  m jsonb;
  v_pid text; v_wid text; v_lot text; v_qchg numeric; v_rate numeric;
  v_cur numeric; v_after numeric;
  v_balances jsonb := '[]'::jsonb;
  v_count int := 0;
begin
  perform public._require_staff();
  if v_type = '' then raise exception 'voucherType is required' using errcode = '22023'; end if;
  if v_no = '' then raise exception 'voucherNo is required' using errcode = '22023'; end if;
  if v_dt = '' then raise exception 'postingDatetime is required' using errcode = '22023'; end if;
  if jsonb_array_length(v_moves) = 0 then
    raise exception 'at least one stock move is required' using errcode = '22023';
  end if;

  if exists (select 1 from public.stock_ledger_entries where voucher_no = v_no) then
    raise exception 'stock ledger already has entries for voucher "%"', v_no using errcode = '23505';
  end if;

  for m in select value from jsonb_array_elements(v_moves) loop
    v_pid  := btrim(coalesce(m->>'productId', ''));
    v_wid  := btrim(coalesce(m->>'warehouseId', ''));
    v_lot  := nullif(m->>'lotNumber', '');
    v_qchg := (m->>'qtyChange')::numeric;
    v_rate := coalesce((m->>'valuationRate')::numeric, 0);

    if v_pid = '' or v_wid = '' then
      raise exception 'every move needs a productId and a warehouseId' using errcode = '22023';
    end if;
    if v_qchg is null or v_qchg = 0 then
      raise exception 'move for %/% has an invalid qtyChange', v_pid, v_wid using errcode = '22023';
    end if;
    if v_rate < 0 then
      raise exception 'move for %/% has an invalid valuationRate', v_pid, v_wid using errcode = '22023';
    end if;

    select qty into v_cur from public.bin_balances
      where product_id = v_pid and warehouse_id = v_wid;
    v_cur := coalesce(v_cur, 0);
    v_after := v_cur + v_qchg;
    if v_after < 0 then
      raise exception 'stock for %/% would go negative (% + % = %)',
        v_pid, v_wid, v_cur, v_qchg, v_after using errcode = '22023';
    end if;

    insert into public.stock_ledger_entries
      (id, voucher_type, voucher_no, product_id, warehouse_id, lot_number,
       qty_change, qty_after, valuation_rate, posting_datetime, is_cancelled)
    values (gen_random_uuid()::text, v_type, v_no, v_pid, v_wid, v_lot,
            v_qchg, v_after, v_rate, v_dt::timestamptz, false);

    insert into public.bin_balances (id, product_id, warehouse_id, qty, updated_datetime)
    values (gen_random_uuid()::text, v_pid, v_wid, v_after, now())
    on conflict (product_id, warehouse_id)
      do update set qty = excluded.qty, updated_datetime = now();

    v_balances := v_balances ||
      jsonb_build_object('productId', v_pid, 'warehouseId', v_wid, 'qtyAfter', v_after);
    v_count := v_count + 1;
  end loop;

  perform public._audit('post_stock_ledger', 'stock_ledger_entries', v_no, null,
    jsonb_build_object('voucherType', v_type, 'entries', v_count, 'balances', v_balances));

  return jsonb_build_object('voucherNo', v_no, 'entries', v_count, 'balances', v_balances);
end;
$$;

-- ----- post_gl ---------------------------------------------------------
-- The ONLY writer of general_ledger_entries. Must be a balanced double entry.
-- p_payload: { voucherType, voucherNo, postingDatetime, branchId?, lines: [
--   { account, debit?, credit? } ] }
create or replace function public.post_gl(p_payload jsonb)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_type text := btrim(coalesce(p_payload->>'voucherType', ''));
  v_no   text := btrim(coalesce(p_payload->>'voucherNo', ''));
  v_dt   text := btrim(coalesce(p_payload->>'postingDatetime', ''));
  v_branch text := nullif(p_payload->>'branchId', '');
  v_lines jsonb := coalesce(p_payload->'lines', '[]'::jsonb);
  l jsonb;
  v_acct text;
  v_debit numeric; v_credit numeric;
  v_sum_d numeric := 0; v_sum_c numeric := 0;
  v_count int := 0;
begin
  perform public._require_staff();
  if v_type = '' then raise exception 'voucherType is required' using errcode = '22023'; end if;
  if v_no = '' then raise exception 'voucherNo is required' using errcode = '22023'; end if;
  if v_dt = '' then raise exception 'postingDatetime is required' using errcode = '22023'; end if;
  if jsonb_array_length(v_lines) = 0 then
    raise exception 'at least one GL line is required' using errcode = '22023';
  end if;

  for l in select value from jsonb_array_elements(v_lines) loop
    v_acct := btrim(coalesce(l->>'account', ''));
    if v_acct = '' then raise exception 'every GL line needs an account' using errcode = '22023'; end if;
    v_sum_d := v_sum_d + coalesce((l->>'debit')::numeric, 0);
    v_sum_c := v_sum_c + coalesce((l->>'credit')::numeric, 0);
  end loop;

  -- assertBalanced (src/core/ledger.ts) — tolerance 0.005 for float noise.
  if abs(v_sum_d - v_sum_c) > 0.005 then
    raise exception 'GL posting is not balanced: debit % vs credit %', v_sum_d, v_sum_c
      using errcode = '22023';
  end if;

  if exists (select 1 from public.general_ledger_entries where voucher_no = v_no) then
    raise exception 'general ledger already has entries for voucher "%"', v_no using errcode = '23505';
  end if;

  for l in select value from jsonb_array_elements(v_lines) loop
    v_acct   := btrim(l->>'account');
    v_debit  := coalesce((l->>'debit')::numeric, 0);
    v_credit := coalesce((l->>'credit')::numeric, 0);
    insert into public.general_ledger_entries
      (id, voucher_type, voucher_no, account, branch_id, debit, credit, posting_datetime, is_cancelled)
    values (gen_random_uuid()::text, v_type, v_no, v_acct, v_branch,
            v_debit, v_credit, v_dt::timestamptz, false);
    v_count := v_count + 1;
  end loop;

  perform public._audit('post_gl', 'general_ledger_entries', v_no, null,
    jsonb_build_object('voucherType', v_type, 'entries', v_count));

  return jsonb_build_object('voucherNo', v_no, 'entries', v_count);
end;
$$;

-- ----- decide_approval -----------------------------------------------
-- A human resolves a pending approval_requests row: approved | rejected.
-- SoD: the decider may not be the row's requested_by.
create or replace function public.decide_approval(
  p_request_id text, p_decision text, p_reason text
) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r public.approval_requests%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public._require_staff();
  if p_decision <> 'approved' and p_decision <> 'rejected' then
    raise exception 'decision must be "approved" or "rejected"' using errcode = '22023';
  end if;

  select * into r from public.approval_requests where id = p_request_id;
  if not found then
    raise exception 'approval_requests/% does not exist', p_request_id using errcode = 'P0002';
  end if;
  if r.state <> 'pending' then
    raise exception 'approval request is already "%"', r.state using errcode = '55000';
  end if;
  if r.requested_by is not null and r.requested_by = auth.uid()::text then
    raise exception 'segregation of duties violated: the requester may not approve this'
      using errcode = '42501';
  end if;

  update public.approval_requests
    set state = p_decision, decided_by = auth.uid()::text, decision_reason = v_reason
    where id = p_request_id;

  perform public._audit('decide_approval', coalesce(r.entity_type, 'approval_requests'),
    coalesce(r.entity_ref, p_request_id),
    jsonb_build_object('state', 'pending'),
    jsonb_build_object('state', p_decision, 'decidedBy', auth.uid()::text, 'reason', v_reason));

  return jsonb_build_object(
    '$id', p_request_id, 'entityType', coalesce(r.entity_type, ''),
    'entityRef', coalesce(r.entity_ref, ''), 'branchId', r.branch_id,
    'requestedBy', coalesce(r.requested_by, ''), 'state', p_decision,
    'decidedBy', auth.uid()::text, 'decisionReason', v_reason);
end;
$$;

-- ----- review_fraud_flag -------------------------------------------
-- Resolve one open fraud_flags row: reviewed | dismissed.
create or replace function public.review_fraud_flag(p_flag_id text, p_status text)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_current text;
begin
  perform public._require_staff();
  if p_status <> 'reviewed' and p_status <> 'dismissed' then
    raise exception 'status must be "reviewed" or "dismissed"' using errcode = '22023';
  end if;

  select status into v_current from public.fraud_flags where id = p_flag_id;
  if not found then
    raise exception 'fraud_flags/% does not exist', p_flag_id using errcode = 'P0002';
  end if;
  if v_current <> 'open' then
    raise exception 'fraud_flags/% is already "%" — only an open flag can be reviewed',
      p_flag_id, v_current using errcode = '55000';
  end if;

  update public.fraud_flags set status = p_status where id = p_flag_id;

  perform public._audit('review_fraud_flag', 'fraud_flags', p_flag_id,
    jsonb_build_object('status', 'open'), jsonb_build_object('status', p_status));

  return jsonb_build_object('id', p_flag_id, 'status', p_status);
end;
$$;

grant execute on function public.post_stock_ledger(jsonb) to authenticated;
grant execute on function public.post_gl(jsonb) to authenticated;
grant execute on function public.decide_approval(text, text, text) to authenticated;
grant execute on function public.review_fraud_flag(text, text) to authenticated;
