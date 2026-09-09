-- Phase 4.2 — supplier performance. One row per supplier, aggregated in
-- Postgres over `purchase_orders` (never a cached rollup), branch-scoped:
-- SECURITY DEFINER bypasses RLS so `_can_read_branch` is re-applied here.
--
-- Metrics are what the current schema can support honestly:
--   orderCount       — submitted (doc_status = 1) POs
--   submittedValue   — Σ total_value of those POs (spend with this supplier)
--   avgOrderValue    — submittedValue / orderCount
--   cancelledCount   — POs cancelled (doc_status = 2)
--   cancelRate       — cancelledCount / (orderCount + cancelledCount)
--   firstOrderAt / lastOrderAt — relationship span + recency (submitted only)
--
-- On-time-delivery % is intentionally absent: `purchase_orders` carries no
-- promised-vs-received date. Add it when a receipt-date/ETA column lands.
--
-- Mirrors src/modules/purchasing/domain/supplier-performance.ts — keep in lockstep.

set check_function_bodies = off;

create or replace function public.supplier_performance()
  returns jsonb
  language sql
  stable
  security definer
  set search_path = public
as $$
  with po as (
    select supplier_id, doc_status, coalesce(total_value, 0) as total_value, posting_datetime
    from public.purchase_orders
    where doc_status in (1, 2)
      and public._can_read_branch(branch_id)
  ),
  agg as (
    select
      supplier_id,
      count(*) filter (where doc_status = 1) as order_count,
      coalesce(sum(total_value) filter (where doc_status = 1), 0) as submitted_value,
      count(*) filter (where doc_status = 2) as cancelled_count,
      min(posting_datetime) filter (where doc_status = 1) as first_order_at,
      max(posting_datetime) filter (where doc_status = 1) as last_order_at
    from po
    group by supplier_id
    -- A supplier whose only POs were cancelled never actually transacted —
    -- keep it off the report (and out of `supplierCount` / `totalSpend`).
    having count(*) filter (where doc_status = 1) > 0
  ),
  joined as (
    select
      a.supplier_id,
      coalesce(s.name, a.supplier_id) as supplier_name,
      a.order_count,
      a.submitted_value,
      case when a.order_count > 0 then a.submitted_value / a.order_count else 0 end as avg_order_value,
      a.cancelled_count,
      case
        when (a.order_count + a.cancelled_count) > 0
          then a.cancelled_count::double precision / (a.order_count + a.cancelled_count)
        else 0
      end as cancel_rate,
      a.first_order_at,
      a.last_order_at
    from agg a
    left join public.suppliers s on s.id = a.supplier_id
  )
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'supplierId', supplier_id,
      'supplierName', supplier_name,
      'orderCount', order_count,
      'submittedValue', submitted_value,
      'avgOrderValue', avg_order_value,
      'cancelledCount', cancelled_count,
      'cancelRate', cancel_rate,
      'firstOrderAt', first_order_at,
      'lastOrderAt', last_order_at
    ) order by submitted_value desc, supplier_name), '[]'::jsonb),
    'totalSpend', coalesce(sum(submitted_value), 0),
    'supplierCount', count(*)
  )
  from joined;
$$;

revoke all on function public.supplier_performance() from public;
grant execute on function public.supplier_performance() to authenticated;
