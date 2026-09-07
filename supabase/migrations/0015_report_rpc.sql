-- Phase 4.2 — server-side report aggregation. Trial balance and customer
-- aging were "pull up to 5,000 rows then reduce on the client"; they now
-- aggregate in Postgres over the full ledger, branch-scoped (a branch role
-- sees only its branch — RLS is bypassed by SECURITY DEFINER, so the scope is
-- re-applied here via _can_read_branch).
--
-- Mirrors src/modules/accounting/domain/{gl,aging}.ts — keep in lockstep.

set check_function_bodies = off;

-- ----- trial_balance ------------------------------------------------
create or replace function public.trial_balance(
  p_from timestamptz default null, p_to timestamptz default null
) returns jsonb
  language sql stable security definer set search_path = public as $$
  with r as (
    select account, sum(debit) as debit, sum(credit) as credit
    from public.general_ledger_entries
    where not coalesce(is_cancelled, false)
      and (p_from is null or posting_datetime >= p_from)
      and (p_to is null or posting_datetime <= p_to)
      and public._can_read_branch(branch_id)
    group by account
  )
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'account', account, 'debit', debit, 'credit', credit, 'balance', debit - credit
    ) order by account), '[]'::jsonb),
    'totalDebit', coalesce(sum(debit), 0),
    'totalCredit', coalesce(sum(credit), 0)
  )
  from r;
$$;

-- ----- customer_aging --------------------------------------------
-- Only doc_status = 1 credit-side invoices create a receivable. Receipts are
-- applied oldest-invoice-first (FIFO) so the aged remainder lands in the right
-- bucket. `outstanding` = Σ credit-side net_total − Σ receipts (may be < 0).
create or replace function public.customer_aging(p_as_of timestamptz)
  returns jsonb
  language sql stable security definer set search_path = public as $$
  with cust as (
    select id, name, coalesce(credit_limit, 0) as cl
    from public.customers
    where public._can_read_branch(branch_id)
  ),
  inv as (
    select customer_id, net_total,
      coalesce(sum(net_total) over (
        partition by customer_id order by posting_datetime, id
        rows between unbounded preceding and 1 preceding), 0) as cum_before,
      floor(extract(epoch from (p_as_of - posting_datetime)) / 86400)::int as age
    from public.sales_invoices
    where doc_status = 1
      and payment_method in ('credit', 'partial', 'post_dated_cheque')
      and public._can_read_branch(branch_id)
  ),
  rec as (
    select customer_id, sum(amount) as total_rec
    from public.receipts
    where doc_status = 1 and public._can_read_branch(branch_id)
    group by customer_id
  ),
  lines as (
    select i.customer_id, i.age,
      greatest(0, i.net_total - greatest(0, coalesce(r.total_rec, 0) - i.cum_before)) as unpaid
    from inv i left join rec r on r.customer_id = i.customer_id
  ),
  bucketed as (
    select customer_id,
      coalesce(sum(unpaid) filter (where age <= 30), 0) as b0,
      coalesce(sum(unpaid) filter (where age > 30 and age <= 60), 0) as b1,
      coalesce(sum(unpaid) filter (where age > 60 and age <= 90), 0) as b2,
      coalesce(sum(unpaid) filter (where age > 90), 0) as b3,
      coalesce(max(age) filter (where unpaid > 0.0000001), 0) as oldest
    from lines
    group by customer_id
  ),
  totals as (
    select customer_id, sum(net_total) as invoiced from inv group by customer_id
  ),
  ids as (
    select customer_id from totals union select customer_id from rec
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'customerId', x.customer_id,
    'customerName', coalesce(c.name, x.customer_id),
    'outstanding', coalesce(t.invoiced, 0) - coalesce(r.total_rec, 0),
    'creditLimit', coalesce(c.cl, 0),
    'buckets', jsonb_build_object(
      '0-30', coalesce(b.b0, 0), '31-60', coalesce(b.b1, 0),
      '61-90', coalesce(b.b2, 0), '90+', coalesce(b.b3, 0)),
    'oldestDays', coalesce(b.oldest, 0)
  ) order by coalesce(c.name, x.customer_id)), '[]'::jsonb)
  from ids x
  left join cust c on c.id = x.customer_id
  left join totals t on t.customer_id = x.customer_id
  left join rec r on r.customer_id = x.customer_id
  left join bucketed b on b.customer_id = x.customer_id;
$$;

grant execute on function public.trial_balance(timestamptz, timestamptz) to authenticated;
grant execute on function public.customer_aging(timestamptz) to authenticated;
