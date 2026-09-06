-- Story 2.4 — rep daily close-out, server side.
--
-- Two RPCs replace the hand-typed `expected` bag and the client-computed
-- confirmation:
--   * build_rep_closeout_expected(rep, date) → the { products, cash } bag,
--     assembled from that rep's issued (rep_stock_issues) / sold
--     (sales_invoices) / returned (return_requests) movement for the day, plus
--     expected cash by method from invoices + receipts.
--   * confirm_rep_closeout(row_id) → recomputes stock/cash variance
--     authoritatively from the row's stored `expected` vs `actual`, sets the
--     status (confirmed | flagged), stamps confirmed_by, flips doc_status → 1,
--     and NOTIFIES the System Admins when the close-out is flagged
--     (Plan §2.4: "variance → Account Manager confirm + auto-flag to Admin").
--
-- Reconciliation mirrors src/modules/sales/domain/closeout.ts — keep in lockstep.

set check_function_bodies = off;

-- Deltas within this are treated as exact (float noise). = CLOSEOUT_EPSILON.
-- (1e-6, written out so it is a plain numeric literal.)

create or replace function public.build_rep_closeout_expected(
  p_rep_user_id text, p_business_date text
) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  v_date date := p_business_date::date;
  v_products jsonb;
  v_cash jsonb;
begin
  perform public._require_staff();
  if coalesce(btrim(p_rep_user_id), '') = '' then
    raise exception 'rep is required' using errcode = '22023';
  end if;

  with issued as (
    select (l->>'product_id') pid, sum((l->>'qty')::numeric) q
    from public.rep_stock_issues si,
         jsonb_array_elements(coalesce(nullif(si.lines, ''), '[]')::jsonb) l
    where si.rep_user_id = p_rep_user_id and si.doc_status = 1
      and (si.posting_datetime)::date = v_date
    group by 1
  ),
  sold as (
    select (l->>'product_id') pid, sum((l->>'qty')::numeric) q
    from public.sales_invoices inv,
         jsonb_array_elements(coalesce(nullif(inv.lines, ''), '[]')::jsonb) l
    where inv.rep_user_id = p_rep_user_id and inv.doc_status = 1
      and (inv.posting_datetime)::date = v_date
    group by 1
  ),
  returned as (
    select (l->>'product_id') pid, sum((l->>'qty')::numeric) q
    from public.return_requests rr
    join public.sales_invoices inv on inv.reference_id = rr.origin_ref,
         jsonb_array_elements(coalesce(nullif(rr.lines, ''), '[]')::jsonb) l
    where inv.rep_user_id = p_rep_user_id and rr.doc_status = 1
      and (rr.posting_datetime)::date = v_date
    group by 1
  ),
  all_p as (
    select pid from issued
    union select pid from sold
    union select pid from returned
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'product_id', p.pid,
           'issued',    coalesce(i.q, 0),
           'sold',      coalesce(s.q, 0),
           'returned',  coalesce(r.q, 0),
           'remaining', coalesce(i.q, 0) - coalesce(s.q, 0) - coalesce(r.q, 0)
         ) order by p.pid), '[]'::jsonb)
  into v_products
  from all_p p
  left join issued i   on i.pid = p.pid
  left join sold s     on s.pid = p.pid
  left join returned r on r.pid = p.pid;

  with inv_cash as (
    select
      sum(case when payment_method = 'cash' then coalesce(cash_amount, net_total)
               when payment_method = 'partial' then coalesce(cash_amount, 0)
               else 0 end) cash,
      sum(case when payment_method = 'bank_transfer' then net_total else 0 end) bank,
      sum(case when payment_method = 'post_dated_cheque' then net_total else 0 end) cheque
    from public.sales_invoices
    where rep_user_id = p_rep_user_id and doc_status = 1
      and (posting_datetime)::date = v_date
  ),
  rec_cash as (
    select
      sum(case when method = 'cash' then amount else 0 end) cash,
      sum(case when method = 'bank_transfer' then amount else 0 end) bank,
      sum(case when method = 'post_dated_cheque' then amount else 0 end) cheque
    from public.receipts
    where collected_by = p_rep_user_id and doc_status = 1
      and (posting_datetime)::date = v_date
  )
  select jsonb_build_array(
    jsonb_build_object('method', 'cash',
      'amount', coalesce(ic.cash, 0) + coalesce(rc.cash, 0)),
    jsonb_build_object('method', 'bank_transfer',
      'amount', coalesce(ic.bank, 0) + coalesce(rc.bank, 0)),
    jsonb_build_object('method', 'post_dated_cheque',
      'amount', coalesce(ic.cheque, 0) + coalesce(rc.cheque, 0))
  ) into v_cash
  from inv_cash ic, rec_cash rc;

  return jsonb_build_object('products', v_products, 'cash', coalesce(v_cash, '[]'::jsonb));
end;
$$;

create or replace function public.confirm_rep_closeout(p_row_id text)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  eps numeric := 0.000001;
  r public.rep_closeouts%rowtype;
  v_expected jsonb;
  v_actual jsonb;
  v_stock_var numeric := 0;
  v_cash_var numeric := 0;
  v_flags text[] := array[]::text[];
  ep jsonb; ap jsonb;
  v_method text;
  v_counted numeric; v_delta numeric; v_gap numeric; v_expected_amt numeric;
  v_status text;
begin
  perform public._require_staff();

  select * into r from public.rep_closeouts where id = p_row_id;
  if not found then
    raise exception 'rep_closeouts/% does not exist', p_row_id using errcode = 'P0002';
  end if;
  if not public._can_act_on_branch(r.branch_id) then
    raise exception 'this close-out belongs to another branch' using errcode = '42501';
  end if;
  if r.status <> 'submitted' then
    raise exception 'only a submitted close-out can be confirmed (is "%")', r.status
      using errcode = '55000';
  end if;

  v_expected := coalesce(nullif(r.expected, ''), '{}')::jsonb;
  v_actual   := coalesce(nullif(r.actual, ''), '{}')::jsonb;

  -- stock: custody identity + counted vs remaining, per expected product
  for ep in select value from jsonb_array_elements(coalesce(v_expected->'products', '[]'::jsonb)) loop
    v_gap := (ep->>'issued')::numeric
             - ((ep->>'sold')::numeric + (ep->>'returned')::numeric + (ep->>'remaining')::numeric);
    if abs(v_gap) > eps then
      v_flags := v_flags || ('custody:' || (ep->>'product_id') || ':' || v_gap);
    end if;

    select (x->>'counted')::numeric into v_counted
    from jsonb_array_elements(coalesce(v_actual->'products', '[]'::jsonb)) x
    where x->>'product_id' = ep->>'product_id'
    limit 1;
    v_counted := coalesce(v_counted, 0);
    v_delta := v_counted - (ep->>'remaining')::numeric;
    v_stock_var := v_stock_var + v_delta;
    if abs(v_delta) > eps then
      v_flags := v_flags || ('stock:' || (ep->>'product_id') || ':' || v_delta);
    end if;
  end loop;

  -- counted product with no expected row → unexplained stock on the rep
  for ap in select value from jsonb_array_elements(coalesce(v_actual->'products', '[]'::jsonb)) loop
    if not exists (
      select 1 from jsonb_array_elements(coalesce(v_expected->'products', '[]'::jsonb)) e
      where e->>'product_id' = ap->>'product_id'
    ) and abs((ap->>'counted')::numeric) > eps then
      v_stock_var := v_stock_var + (ap->>'counted')::numeric;
      v_flags := v_flags || ('stock:' || (ap->>'product_id') || ':' || (ap->>'counted'));
    end if;
  end loop;

  -- cash: delta per method across the union of expected + actual
  for v_method in
    select x->>'method' from jsonb_array_elements(coalesce(v_expected->'cash', '[]'::jsonb)) x
    union
    select x->>'method' from jsonb_array_elements(coalesce(v_actual->'cash', '[]'::jsonb)) x
  loop
    select coalesce((x->>'amount')::numeric, 0) into v_counted
      from jsonb_array_elements(coalesce(v_actual->'cash', '[]'::jsonb)) x
      where x->>'method' = v_method limit 1;
    select coalesce((x->>'amount')::numeric, 0) into v_expected_amt
      from jsonb_array_elements(coalesce(v_expected->'cash', '[]'::jsonb)) x
      where x->>'method' = v_method limit 1;
    v_delta := coalesce(v_counted, 0) - coalesce(v_expected_amt, 0);
    v_cash_var := v_cash_var + v_delta;
    if abs(v_delta) > eps then
      v_flags := v_flags || ('cash:' || v_method || ':' || v_delta);
    end if;
  end loop;

  if abs(v_stock_var) <= eps then v_stock_var := 0; end if;
  if abs(v_cash_var) <= eps then v_cash_var := 0; end if;
  v_status := case when array_length(v_flags, 1) is null then 'confirmed' else 'flagged' end;

  update public.rep_closeouts
    set status = v_status,
        stock_variance = v_stock_var,
        cash_variance = v_cash_var,
        confirmed_by = auth.uid()::text,
        doc_status = 1
    where id = p_row_id;

  if v_status = 'flagged' then
    begin
      perform public._notify_system_admins(
        'closeout_flagged',
        'تقفيل مندوب موسوم بفروقات: ' || r.reference_id,
        'فرق المخزون ' || v_stock_var || ' — فرق النقدية ' || v_cash_var
          || ' — ' || array_to_string(v_flags, ' | '),
        r.reference_id);
    exception when others then
      raise warning 'confirm_rep_closeout: notify failed for %: %', r.reference_id, sqlerrm;
    end;
  end if;

  perform public._audit('confirm_rep_closeout', 'rep_closeouts', r.reference_id,
    jsonb_build_object('status', 'submitted'),
    jsonb_build_object('status', v_status, 'stockVariance', v_stock_var,
                       'cashVariance', v_cash_var, 'flags', to_jsonb(v_flags)));

  return jsonb_build_object('status', v_status, 'stockVariance', v_stock_var,
                            'cashVariance', v_cash_var, 'flags', to_jsonb(v_flags));
end;
$$;

grant execute on function public.build_rep_closeout_expected(text, text) to authenticated;
grant execute on function public.confirm_rep_closeout(text) to authenticated;
