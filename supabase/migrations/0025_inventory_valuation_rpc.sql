-- Phase 4.2 — inventory valuation. Current stock value per (product, warehouse):
-- on-hand qty from the `bin_balances` projection × a unit cost derived from the
-- stock ledger (weighted average of the IN moves' valuation_rate, falling back
-- to the last positive rate). Warehouse-scoped: SECURITY DEFINER bypasses RLS,
-- so `_can_read_warehouse` is re-applied here.
--
-- "As of now" only — historical valuation would need to reconstruct qty from
-- the ledger and is a later extension.

set check_function_bodies = off;

create or replace function public.inventory_valuation()
  returns jsonb
  language sql
  stable
  security definer
  set search_path = public
as $$
  with cost as (
    select product_id, warehouse_id,
      case
        when sum(qty_change) > 0
          then sum(qty_change * valuation_rate) / nullif(sum(qty_change), 0)
        else max(valuation_rate)
      end as unit_cost
    from public.stock_ledger_entries
    where not coalesce(is_cancelled, false)
      and qty_change > 0
      and valuation_rate > 0
      and public._can_read_warehouse(warehouse_id)
    group by product_id, warehouse_id
  ),
  joined as (
    select b.product_id, b.warehouse_id, b.qty,
      coalesce(c.unit_cost, 0) as unit_cost,
      b.qty * coalesce(c.unit_cost, 0) as value
    from public.bin_balances b
    left join cost c using (product_id, warehouse_id)
    where b.qty <> 0
      and public._can_read_warehouse(b.warehouse_id)
  )
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'productId', product_id,
      'warehouseId', warehouse_id,
      'qty', qty,
      'unitCost', unit_cost,
      'value', value
    ) order by warehouse_id, product_id), '[]'::jsonb),
    'totalValue', coalesce(sum(value), 0),
    'lineCount', count(*)
  )
  from joined;
$$;
