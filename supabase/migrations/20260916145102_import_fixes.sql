-- Code-review fixes for the opening-stock and bank-statement importers
-- (20260915174254_import_opening_stock.sql, 20260915175344_bank_statement_import.sql):
--
-- 1. import_opening_stock's duplicate guard only checked ALREADY-PERSISTED
--    stock_ledger_entries -- inserts happen in one post_stock_ledger call
--    AFTER the whole row loop, so two rows in the same CSV for the same
--    product/warehouse both passed the check and both got posted, silently
--    doubling the opening balance. Now also tracks pairs already queued
--    within the same import call.
-- 2. import_bank_statement's content-based duplicate skip could silently
--    drop a genuinely distinct transaction that happens to share date/
--    description/reference/debit/credit with an earlier line (e.g. two
--    identical bank fees on the same day) -- financial data must never be
--    silently dropped. Duplicate detection removed entirely; every valid
--    row is now inserted. A true re-upload of the same file will create
--    visible duplicate rows an accountant can review and delete -- a safer
--    failure mode than an invisible missing transaction.
-- 3. bank_statement_lines_read was created without a preceding
--    `drop policy if exists`, unlike every other RLS migration in this repo
--    -- breaks idempotent re-application (`supabase db push --include-all`
--    run twice would error "policy already exists").

set check_function_bodies = off;

create or replace function public.import_opening_stock(p_rows jsonb)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb;
  v_product_code text;
  v_warehouse_name text;
  v_qty numeric;
  v_rate numeric;
  v_pid text;
  v_wid text;
  v_pair text;
  v_seen text[] := array[]::text[];
  v_applied int := 0;
  v_skipped int := 0;
  v_errors text[] := array[]::text[];
  v_moves jsonb := '[]'::jsonb;
  v_ref jsonb;
  v_voucher_no text;
begin
  perform public._require_staff();
  if not public.has_role('system_admin') then
    raise exception 'only a System Admin may import opening stock' using errcode = '42501';
  end if;

  for v_row in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_product_code := btrim(coalesce(v_row->>'product_code', ''));
    v_warehouse_name := btrim(coalesce(v_row->>'warehouse_name', ''));
    v_qty := nullif(v_row->>'qty', '')::numeric;
    v_rate := nullif(v_row->>'unit_cost', '')::numeric;

    if v_product_code = '' or v_warehouse_name = '' or v_qty is null or v_qty <= 0
       or v_rate is null or v_rate < 0 then
      v_skipped := v_skipped + 1;
      v_errors := array_append(v_errors, format('%s/%s: صف غير صالح', v_product_code, v_warehouse_name));
      continue;
    end if;

    select id into v_pid from public.products where code = v_product_code;
    if v_pid is null then
      v_skipped := v_skipped + 1;
      v_errors := array_append(v_errors, format('%s: صنف غير معروف', v_product_code));
      continue;
    end if;

    select id into v_wid from public.warehouses where name = v_warehouse_name limit 1;
    if v_wid is null then
      v_skipped := v_skipped + 1;
      v_errors := array_append(v_errors, format('%s: مخزن غير معروف', v_warehouse_name));
      continue;
    end if;

    v_pair := v_pid || ':' || v_wid;
    if v_pair = any(v_seen) then
      v_skipped := v_skipped + 1;
      v_errors := array_append(
        v_errors, format('%s/%s: مكرر في نفس الملف', v_product_code, v_warehouse_name));
      continue;
    end if;

    if exists (
      select 1 from public.stock_ledger_entries
      where voucher_type = 'OpeningStock' and product_id = v_pid and warehouse_id = v_wid
    ) then
      v_skipped := v_skipped + 1;
      v_errors := array_append(
        v_errors, format('%s/%s: له رصيد افتتاحي مستورد من قبل', v_product_code, v_warehouse_name));
      continue;
    end if;

    v_seen := array_append(v_seen, v_pair);
    v_moves := v_moves || jsonb_build_object(
      'productId', v_pid, 'warehouseId', v_wid, 'qtyChange', v_qty, 'valuationRate', v_rate);
    v_applied := v_applied + 1;
  end loop;

  if v_applied = 0 then
    return jsonb_build_object('applied', 0, 'skipped', v_skipped, 'errors', to_jsonb(v_errors));
  end if;

  v_ref := public.allocate_reference_id('AdjustmentEntry');
  v_voucher_no := v_ref->>'referenceId';

  perform public.post_stock_ledger(jsonb_build_object(
    'voucherType', 'OpeningStock',
    'voucherNo', v_voucher_no,
    'postingDatetime', now()::text,
    'moves', v_moves
  ));

  return jsonb_build_object(
    'applied', v_applied, 'skipped', v_skipped, 'errors', to_jsonb(v_errors), 'voucherNo', v_voucher_no);
end;
$$;

create or replace function public.import_bank_statement(p_rows jsonb)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb;
  v_date date;
  v_desc text;
  v_ref text;
  v_debit numeric;
  v_credit numeric;
  v_balance numeric;
  v_applied int := 0;
  v_skipped int := 0;
  v_batch text := 'BSI-' || to_char(now(), 'YYYYMMDDHH24MISS');
  v_caller text := auth.uid()::text;
begin
  perform public._require_staff();
  if not public.has_role('system_admin') then
    raise exception 'only a System Admin may import a bank statement' using errcode = '42501';
  end if;

  for v_row in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_date := nullif(v_row->>'statement_date', '')::date;
    v_desc := btrim(coalesce(v_row->>'description', ''));
    v_ref := nullif(btrim(coalesce(v_row->>'reference', '')), '');
    v_debit := coalesce(nullif(v_row->>'debit', '')::numeric, 0);
    v_credit := coalesce(nullif(v_row->>'credit', '')::numeric, 0);
    v_balance := nullif(v_row->>'balance', '')::numeric;

    if v_date is null or v_desc = '' or (v_debit = 0 and v_credit = 0)
       or v_debit < 0 or v_credit < 0 then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.bank_statement_lines
      (id, statement_date, description, reference, debit, credit, balance, imported_by, batch_ref)
    values
      (gen_random_uuid()::text, v_date, v_desc, v_ref, v_debit, v_credit, v_balance, v_caller, v_batch);
    v_applied := v_applied + 1;
  end loop;

  perform public._audit('import_bank_statement', 'bank_statement_lines', v_batch, null,
    jsonb_build_object('applied', v_applied, 'skipped', v_skipped));

  return jsonb_build_object('applied', v_applied, 'skipped', v_skipped, 'batchRef', v_batch);
end;
$$;

drop policy if exists "bank_statement_lines_read" on public."bank_statement_lines";
create policy "bank_statement_lines_read" on public."bank_statement_lines"
  for select to authenticated
  using (public.has_role('system_admin') or public.has_role('chief_accountant'));
