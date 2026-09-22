-- Two additions, bundled because they were requested together:
--
-- 1. cash_flow_financing(from, to) — the one piece of a cash-flow statement
--    that can't be derived from a plain trial-balance snapshot: how much of
--    each capital contribution/withdrawal in the period actually moved cash.
--    A non-cash contribution (a vehicle, a building) still credits
--    owners_capital, but debits a fixed-asset account, not cash/bank/treasury
--    — so it must NOT show up as a financing cash inflow. This walks each
--    contribution/withdrawal voucher's own lines to tell the two apart,
--    rather than trusting the owners_capital account's aggregate delta
--    (which mixes both).
--
-- 2. Period lock — a System Admin can set a "locked through" date; posting a
--    GL or stock-ledger entry dated at or before it is rejected for everyone
--    else. This is the fiscal-period-close control every source on ERP
--    internal controls converges on ("nothing prevents a backdated entry from
--    silently corrupting a period you've already reported on" was a real,
--    confirmed gap). Deliberately NOT wired into submit_document/
--    cancel_document: submit_document always re-stamps posting_datetime to
--    now() at submit time, so a lock check there could never trigger — the
--    only place a document's stored posting_datetime can legitimately land in
--    an already-closed period is a late "Post to GL" click on an old
--    submission, which is exactly what post_gl/post_stock_ledger guard.

set check_function_bodies = off;

-- ----- 1. cash_flow_financing ------------------------------------------

create or replace function public.cash_flow_financing(p_from timestamptz, p_to timestamptz)
  returns jsonb
  language sql stable security definer set search_path = public as $$
  with contributed as (
    -- Only the cash-like debit line of each CapitalContribution voucher —
    -- a non-cash contribution's fixed-asset debit line is excluded, and its
    -- owners_capital credit line is excluded too (that's the equity side,
    -- not the cash side).
    select g.voucher_no, sum(g.debit) as cash_in
    from public.general_ledger_entries g
    where g.voucher_type = 'CapitalContribution'
      and g.account in ('cash', 'bank', 'treasury')
      and not coalesce(g.is_cancelled, false)
      and g.posting_datetime >= p_from and g.posting_datetime <= p_to
      and public._can_read_branch(g.branch_id)
    group by g.voucher_no
  ),
  withdrawn as (
    -- A withdrawal always credits a cash-like source account by construction
    -- (method is cash/bank_transfer) — no non-cash withdrawal exists.
    select sum(g.credit) as cash_out
    from public.general_ledger_entries g
    where g.voucher_type = 'CapitalWithdrawal'
      and g.account in ('cash', 'bank', 'treasury')
      and not coalesce(g.is_cancelled, false)
      and g.posting_datetime >= p_from and g.posting_datetime <= p_to
      and public._can_read_branch(g.branch_id)
  )
  select jsonb_build_object(
    'capitalContributed', coalesce((select sum(cash_in) from contributed), 0),
    'capitalWithdrawn', coalesce((select cash_out from withdrawn), 0)
  );
$$;

grant execute on function public.cash_flow_financing(timestamptz, timestamptz) to authenticated;

-- ----- 2. period lock ----------------------------------------------------
-- `system_settings` — a small key/value control table. `id` IS the setting
-- key (e.g. 'posting_lock_date'), set explicitly on insert. Read-only to
-- clients like every control table (stock_ledger_entries, audit_log, …) —
-- the only writer is set_posting_lock_date (SECURITY DEFINER, system_admin-
-- gated, audited). 0001/schema.ts already define this for a from-scratch
-- build; this creates it on the already-provisioned project.

CREATE TABLE IF NOT EXISTS public."system_settings" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "value" text NOT NULL,
  "updated_by" text
);
DROP TRIGGER IF EXISTS "system_settings_set_updated_at" ON public."system_settings";
CREATE TRIGGER "system_settings_set_updated_at" BEFORE UPDATE ON public."system_settings"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."system_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_settings_read" ON public."system_settings";
CREATE POLICY "system_settings_read" ON public."system_settings" FOR SELECT TO authenticated USING (true);
-- No client write policy at all — every write goes through
-- set_posting_lock_date (SECURITY DEFINER, system_admin-gated, audited).

create or replace function public._posting_lock_date() returns date
  language sql stable security definer set search_path = public as $$
  select value::date from public.system_settings where id = 'posting_lock_date'
$$;

-- Rejects a posting dated at or before the lock, for anyone but a System
-- Admin (an admin can still deliberately backdate a correction into a closed
-- period — the lock stops accidents, not authorised overrides).
create or replace function public._assert_not_locked(p_posting_datetime timestamptz) returns void
  language plpgsql stable security definer set search_path = public as $$
declare
  v_lock date := public._posting_lock_date();
begin
  if v_lock is not null and p_posting_datetime::date <= v_lock and not public.has_role('system_admin') then
    raise exception 'posting date % falls in a closed accounting period (locked through %)',
      p_posting_datetime::date, v_lock using errcode = '55000';
  end if;
end;
$$;

-- System Admin sets (or clears, with a null date) the lock. Audited.
create or replace function public.set_posting_lock_date(p_date date)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_before text;
begin
  perform public._require_staff();
  if not public.has_role('system_admin') then
    raise exception 'only a System Admin may set the posting lock date' using errcode = '42501';
  end if;

  select value into v_before from public.system_settings where id = 'posting_lock_date';

  if p_date is null then
    delete from public.system_settings where id = 'posting_lock_date';
  else
    insert into public.system_settings (id, value, updated_by, updated_at)
    values ('posting_lock_date', p_date::text, auth.uid()::text, now())
    on conflict (id) do update
      set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  end if;

  perform public._audit('set_posting_lock_date', 'system_settings', 'posting_lock_date',
    jsonb_build_object('date', v_before), jsonb_build_object('date', p_date));

  return jsonb_build_object('date', p_date);
end;
$$;

grant execute on function public.set_posting_lock_date(date) to authenticated;

-- ----- wire the lock check into the two immutable-ledger writers ---------
-- Bodies unchanged except for the one added `perform _assert_not_locked(...)`
-- line right after the existing staff check.

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
  perform public._assert_not_locked(v_dt::timestamptz);
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
  perform public._assert_not_locked(v_dt::timestamptz);
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

grant execute on function public.post_stock_ledger(jsonb) to authenticated;
grant execute on function public.post_gl(jsonb) to authenticated;
