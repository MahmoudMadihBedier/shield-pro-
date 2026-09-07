-- Returns fixed — a return request now records the customer the goods came
-- back from and the amount to credit back to their account. The customer's
-- receivables (aging + credit check) subtract submitted return refunds:
--   outstanding = Σ credit-side invoices − Σ receipts − Σ return refunds
--
-- 0001 / schema.ts regenerated; this adds the columns + re-issues the two
-- aggregation RPCs on the already-provisioned project.

set check_function_bodies = off;

alter table public.return_requests add column if not exists customer_id text;
alter table public.return_requests add column if not exists refund_amount double precision;
create index if not exists returns_customer_idx on public.return_requests (customer_id);

-- ----- check_customer_credit (returns now reduce outstanding) ----------
create or replace function public.check_customer_credit(
  p_customer_id text, p_new_amount numeric default 0
) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  v_limit numeric;
  v_invoiced numeric;
  v_received numeric;
  v_returned numeric;
  v_outstanding numeric;
  v_projected numeric;
begin
  perform public._require_staff();
  if coalesce(btrim(p_customer_id), '') = '' then
    raise exception 'customer is required' using errcode = '22023';
  end if;

  select coalesce(credit_limit, 0) into v_limit from public.customers where id = p_customer_id;
  if v_limit is null then
    raise exception 'customer % does not exist', p_customer_id using errcode = 'P0002';
  end if;

  select coalesce(sum(net_total), 0) into v_invoiced
    from public.sales_invoices
    where customer_id = p_customer_id and doc_status = 1
      and payment_method in ('credit', 'partial', 'post_dated_cheque');

  select coalesce(sum(amount), 0) into v_received
    from public.receipts
    where customer_id = p_customer_id and doc_status = 1;

  select coalesce(sum(refund_amount), 0) into v_returned
    from public.return_requests
    where customer_id = p_customer_id and doc_status = 1;

  v_outstanding := v_invoiced - v_received - v_returned;
  v_projected := v_outstanding + coalesce(p_new_amount, 0);

  return jsonb_build_object(
    'ok', v_projected <= v_limit,
    'creditLimit', v_limit,
    'outstanding', v_outstanding,
    'available', v_limit - v_outstanding,
    'overBy', case when v_projected > v_limit then v_projected - v_limit else 0 end
  );
end;
$$;

-- ----- customer_aging (returns applied FIFO alongside receipts) --------
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
  credits as (
    -- receipts + return refunds both reduce the balance oldest-invoice-first
    select customer_id, sum(amt) as total_credit from (
      select customer_id, amount as amt from public.receipts
        where doc_status = 1 and public._can_read_branch(branch_id)
      union all
      select customer_id, coalesce(refund_amount, 0) as amt from public.return_requests
        where doc_status = 1 and customer_id is not null and public._can_read_branch(branch_id)
    ) x
    group by customer_id
  ),
  lines as (
    select i.customer_id, i.age,
      greatest(0, i.net_total - greatest(0, coalesce(r.total_credit, 0) - i.cum_before)) as unpaid
    from inv i left join credits r on r.customer_id = i.customer_id
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
    select customer_id from totals union select customer_id from credits
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'customerId', x.customer_id,
    'customerName', coalesce(c.name, x.customer_id),
    'outstanding', coalesce(t.invoiced, 0) - coalesce(r.total_credit, 0),
    'creditLimit', coalesce(c.cl, 0),
    'buckets', jsonb_build_object(
      '0-30', coalesce(b.b0, 0), '31-60', coalesce(b.b1, 0),
      '61-90', coalesce(b.b2, 0), '90+', coalesce(b.b3, 0)),
    'oldestDays', coalesce(b.oldest, 0)
  ) order by coalesce(c.name, x.customer_id)), '[]'::jsonb)
  from ids x
  left join cust c on c.id = x.customer_id
  left join totals t on t.customer_id = x.customer_id
  left join credits r on r.customer_id = x.customer_id
  left join bucketed b on b.customer_id = x.customer_id;
$$;

grant execute on function public.check_customer_credit(text, numeric) to authenticated;
grant execute on function public.customer_aging(timestamptz) to authenticated;
