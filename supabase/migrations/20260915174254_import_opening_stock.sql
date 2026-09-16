-- Phase 4.1 — opening-stock import. A System Admin uploads a CSV of
-- `product_code,warehouse_name,qty,unit_cost`; each valid row posts one
-- normal stock-ledger move via `post_stock_ledger` (never a direct
-- `bin_balances` write — the ledger stays the single source of truth for
-- Plan §4.3's valuation/on-hand reports), batched under ONE freshly
-- allocated `ADJ-<year>-nnnnn` voucher so the whole import is one traceable
-- document. A product/warehouse pair that already has an `OpeningStock`
-- entry is skipped, not re-applied — re-running the same file (or a
-- corrected one that still includes already-imported rows) can't double the
-- balance.

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

    if exists (
      select 1 from public.stock_ledger_entries
      where voucher_type = 'OpeningStock' and product_id = v_pid and warehouse_id = v_wid
    ) then
      v_skipped := v_skipped + 1;
      v_errors := array_append(
        v_errors, format('%s/%s: له رصيد افتتاحي مستورد من قبل', v_product_code, v_warehouse_name));
      continue;
    end if;

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

revoke all on function public.import_opening_stock(jsonb) from public;
grant execute on function public.import_opening_stock(jsonb) to authenticated;
