-- Shield Pro — CRM portal account statement.
--
-- A running-balance ledger of the signed-in customer's OWN account, computed
-- server-side over the WHOLE history (not the newest-100 page the portal list
-- reads return). Matches the canonical `buildCustomerStatement`
-- (src/modules/accounting/domain/statement.ts) and `customer_aging`:
--   * only credit-side invoices are a debit — a cash / bank-transfer sale is
--     settled at the till and never hits the account
--     (payment_method in 'credit' | 'partial' | 'post_dated_cheque');
--   * submitted receipts are credits;
--   * submitted return refunds (`return_requests.refund_amount`, migration
--     0018) are credit notes — `sales_invoices.net_total` is CHECK (>= 0), so
--     a return is its own row, never a negative invoice;
--   * rows are ordered oldest-first, debit before credit on a tie, amounts
--     rounded to whole cents so the last running balance == Σdebit − Σcredit.
--
-- Customer scoping via `_portal_customer()` (auth.uid() → customers.portal_user_id);
-- SECURITY DEFINER, so it does not depend on the staff RLS policies.

set check_function_bodies = off;

create or replace function public.portal_statement()
  returns jsonb
  language sql
  stable
  security definer
  set search_path = public
as $$
  with c as (
    select (public._portal_customer()).id as id
  ),
  moves as (
    -- credit-side invoices → debit
    select
      si.posting_datetime as at,
      'invoice'::text as kind,
      si.reference_id as reference,
      round(si.net_total::numeric, 2) as debit,
      0::numeric as credit
    from public.sales_invoices si, c
    where si.customer_id = c.id
      and si.doc_status = 1
      and si.payment_method in ('credit', 'partial', 'post_dated_cheque')

    union all

    -- submitted return refunds → credit note
    select
      rr.posting_datetime as at,
      'return'::text as kind,
      rr.reference_id as reference,
      0::numeric as debit,
      round(greatest(coalesce(rr.refund_amount, 0), 0)::numeric, 2) as credit
    from public.return_requests rr, c
    where rr.customer_id = c.id
      and rr.doc_status = 1
      and coalesce(rr.refund_amount, 0) > 0

    union all

    -- submitted receipts → credit
    select
      r.posting_datetime as at,
      'receipt'::text as kind,
      r.invoice_ref as reference,
      0::numeric as debit,
      round(greatest(r.amount, 0)::numeric, 2) as credit
    from public.receipts r, c
    where r.customer_id = c.id
      and r.doc_status = 1
  ),
  ordered as (
    select
      *,
      -- amounts are already whole-cent numerics, so this running sum is exact
      sum(debit - credit) over (
        order by at,
          case kind when 'invoice' then 0 when 'return' then 1 else 2 end,
          reference
        rows between unbounded preceding and current row
      ) as balance
    from moves
  )
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'date', at,
      'kind', kind,
      'reference', reference,
      'debit', debit,
      'credit', credit,
      'balance', balance
    ) order by at,
      case kind when 'invoice' then 0 when 'return' then 1 else 2 end,
      reference),
    '[]'::jsonb),
    'totalDebit', coalesce(sum(debit), 0),
    'totalCredit', coalesce(sum(credit), 0),
    'closingBalance', coalesce(sum(debit - credit), 0)
  )
  from ordered;
$$;

revoke all on function public.portal_statement() from public;
grant execute on function public.portal_statement() to authenticated;
