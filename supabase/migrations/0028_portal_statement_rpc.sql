-- Shield Pro — CRM portal account statement.
--
-- A running-balance ledger of the signed-in customer's OWN account, computed
-- server-side over the WHOLE history (not the newest-100 page the portal list
-- reads return). Mirrors the canonical `buildCustomerStatement`
-- (src/modules/accounting/domain/statement.ts):
--   * only credit-side invoices are a debit — a cash / bank-transfer sale is
--     settled at the till and never hits the account
--     (payment_method in 'credit' | 'partial' | 'post_dated_cheque');
--   * a negative-net invoice is a return credit note (migration 0018);
--   * submitted receipts are credits;
--   * rows are ordered oldest-first, invoice before credit on a tie, and the
--     balance is rounded to whole cents.
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
    -- credit-side invoices → debit; negative-net (returns) → credit
    select
      si.posting_datetime as at,
      case when si.net_total >= 0 then 'invoice' else 'return' end as kind,
      si.reference_id as reference,
      greatest(si.net_total, 0) as debit,
      greatest(-si.net_total, 0) as credit
    from public.sales_invoices si, c
    where si.customer_id = c.id
      and si.doc_status = 1
      and si.payment_method in ('credit', 'partial', 'post_dated_cheque')

    union all

    select
      r.posting_datetime as at,
      'receipt' as kind,
      r.invoice_ref as reference,
      0 as debit,
      greatest(r.amount, 0) as credit
    from public.receipts r, c
    where r.customer_id = c.id
      and r.doc_status = 1
  ),
  ordered as (
    select
      *,
      round(
        sum(debit - credit) over (
          order by at, case kind when 'invoice' then 0 when 'return' then 1 else 2 end,
          reference
          rows between unbounded preceding and current row
        )::numeric,
        2
      ) as balance
    from moves
  )
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'date', at,
      'kind', kind,
      'reference', reference,
      'debit', round(debit::numeric, 2),
      'credit', round(credit::numeric, 2),
      'balance', balance
    ) order by at, case kind when 'invoice' then 0 when 'return' then 1 else 2 end, reference),
    '[]'::jsonb),
    'totalDebit', coalesce(round(sum(debit)::numeric, 2), 0),
    'totalCredit', coalesce(round(sum(credit)::numeric, 2), 0),
    -- closing balance = Σ debit − Σ credit (equals the last row's running
    -- balance, without depending on a tie-break in the ordering)
    'closingBalance', coalesce(round(sum(debit - credit)::numeric, 2), 0)
  )
  from ordered;
$$;

revoke all on function public.portal_statement() from public;
grant execute on function public.portal_statement() to authenticated;
