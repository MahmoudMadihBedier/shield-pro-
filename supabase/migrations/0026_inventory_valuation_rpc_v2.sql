-- Phase 4.2 — inventory valuation, revision 2. Supersedes the 0025 body.
--
-- Fixes from code review:
--  1. Lock EXECUTE to `authenticated` (0025 relied on the PUBLIC default).
--  2. Real "last positive rate" fallback. 0025's `else max(valuation_rate)`
--     branch was dead code — the WHERE already filtered `qty_change > 0`, so
--     `sum(qty_change) > 0` was always true. A product whose stock arrived
--     without a priced IN move (e.g. an opening balance written straight to
--     `bin_balances`, or a transfer-in) now falls back to the most recent
--     positive `valuation_rate` on ANY ledger row for that (product, warehouse).
--  3. Honesty about un-costed lines. A bin with stock but no rate anywhere is
--     still listed (its qty matters) but flagged `hasCost = false`, and the
--     payload carries `uncostedLineCount` so the UI can caveat the total
--     instead of silently understating it as if those lines were worth 0.
--
-- Warehouse-scoped: SECURITY DEFINER bypasses RLS, so `_can_read_warehouse`
-- is re-applied. "As of now" only.

set check_function_bodies = off;

create or replace function public.inventory_valuation()
  returns jsonb
  language sql
  stable
  security definer
  set search_path = public
as $$
  -- Branch scope is applied ONCE, on `bin_balances` in `joined`. The cost CTEs
  -- feed that join, so an unreadable warehouse's ledger rows can never surface;
  -- re-checking `_can_read_warehouse` per scanned ledger row here would just be
  -- a correlated subquery over the whole ledger for no added safety.
  with in_moves as (
    -- Weighted-average rate over priced receipts (primary cost basis).
    select product_id, warehouse_id,
      sum(qty_change * valuation_rate) / nullif(sum(qty_change), 0) as wavg_rate
    from public.stock_ledger_entries
    where not coalesce(is_cancelled, false)
      and qty_change > 0
      and valuation_rate > 0
    group by product_id, warehouse_id
  ),
  last_rate as (
    -- Fallback: the most recent positive rate seen on any ledger row.
    select distinct on (product_id, warehouse_id)
      product_id, warehouse_id, valuation_rate as rate
    from public.stock_ledger_entries
    where not coalesce(is_cancelled, false)
      and valuation_rate > 0
    order by product_id, warehouse_id, posting_datetime desc, id desc
  ),
  joined as (
    select
      b.product_id,
      b.warehouse_id,
      b.qty,
      coalesce(im.wavg_rate, lr.rate) as unit_cost,
      (coalesce(im.wavg_rate, lr.rate) is not null) as has_cost,
      b.qty * coalesce(im.wavg_rate, lr.rate, 0) as value
    from public.bin_balances b
    left join in_moves im using (product_id, warehouse_id)
    left join last_rate lr using (product_id, warehouse_id)
    where b.qty <> 0
      and public._can_read_warehouse(b.warehouse_id)
  )
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'productId', product_id,
      'warehouseId', warehouse_id,
      'qty', qty,
      'unitCost', coalesce(unit_cost, 0),
      'value', value,
      'hasCost', has_cost
    ) order by warehouse_id, product_id), '[]'::jsonb),
    'totalValue', coalesce(sum(value), 0),
    'lineCount', count(*),
    'uncostedLineCount', count(*) filter (where not has_cost)
  )
  from joined;
$$;

revoke all on function public.inventory_valuation() from public;
grant execute on function public.inventory_valuation() to authenticated;
