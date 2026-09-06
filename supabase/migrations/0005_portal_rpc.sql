-- Shield Pro — customer-facing CRM portal read RPCs.
-- Replaces the Appwrite `shield-server` routes portal/me, portal/invoices,
-- portal/invoice-detail, portal/receipts (functions/routes/portal-data.ts).
--
-- Every function resolves the caller's OWN customer_id server-side from
-- customers.portal_user_id = auth.uid() — never from an argument — and every
-- result is scoped to that id. A portal session never gets a raw table handle.
-- SECURITY DEFINER so the read does not depend on the staff-oriented RLS
-- SELECT policies; the customer scoping here is the access control.

set check_function_bodies = off;

create or replace function public._portal_customer() returns public.customers
  language plpgsql stable security definer set search_path = public as $$
declare
  c public.customers%rowtype;
begin
  if auth.uid() is null then
    raise exception 'a signed-in caller is required' using errcode = '42501';
  end if;
  select * into c from public.customers where portal_user_id = auth.uid()::text limit 1;
  if not found then
    raise exception 'no portal account is linked to this session' using errcode = '42501';
  end if;
  return c;
end;
$$;

-- clamp: default 25, max 100, floor, positive.
create or replace function public._portal_page_size(p int) returns int
  language sql immutable as $$
  select case
    when p is null or p <= 0 then 25
    else least(p, 100)
  end
$$;

create or replace function public.portal_me()
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  c public.customers%rowtype := public._portal_customer();
begin
  return jsonb_build_object(
    'customerId', c.id, 'code', c.code, 'name', c.name,
    'phone', nullif(btrim(coalesce(c.phone, '')), ''),
    'branchId', nullif(btrim(coalesce(c.branch_id, '')), ''));
end;
$$;

create or replace function public.portal_invoices(p_page int default 0, p_page_size int default null)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  c public.customers%rowtype := public._portal_customer();
  v_size int := public._portal_page_size(p_page_size);
  v_page int := greatest(coalesce(p_page, 0), 0);
  v_total int;
  v_rows jsonb;
begin
  select count(*) into v_total from public.sales_invoices where customer_id = c.id;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows from (
    select
      id,
      reference_id     as "referenceId",
      doc_status       as "docStatus",
      net_total        as "netTotal",
      payment_method   as "paymentMethod",
      posting_datetime as "postingDatetime"
    from public.sales_invoices
    where customer_id = c.id
    order by posting_datetime desc
    limit v_size offset v_page * v_size
  ) t;

  return jsonb_build_object('rows', v_rows, 'total', v_total);
end;
$$;

create or replace function public.portal_invoice_detail(p_invoice_id text)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  c public.customers%rowtype := public._portal_customer();
  r public.sales_invoices%rowtype;
begin
  if coalesce(btrim(p_invoice_id), '') = '' then
    raise exception 'invoiceId is required' using errcode = '22023';
  end if;
  select * into r from public.sales_invoices where id = p_invoice_id;
  if not found then
    raise exception 'invoice % does not exist', p_invoice_id using errcode = 'P0002';
  end if;
  if r.customer_id <> c.id then
    raise exception 'this invoice does not belong to your account' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'id', r.id, 'referenceId', r.reference_id, 'lines', coalesce(r.lines, ''),
    'grossTotal', r.gross_total, 'discountTotal', coalesce(r.discount_total, 0),
    'netTotal', r.net_total, 'paymentMethod', r.payment_method,
    'postingDatetime', r.posting_datetime, 'docStatus', r.doc_status);
end;
$$;

create or replace function public.portal_receipts(p_page int default 0, p_page_size int default null)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  c public.customers%rowtype := public._portal_customer();
  v_size int := public._portal_page_size(p_page_size);
  v_page int := greatest(coalesce(p_page, 0), 0);
  v_total int;
  v_rows jsonb;
begin
  select count(*) into v_total from public.receipts where customer_id = c.id;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows from (
    select
      id,
      invoice_ref      as "invoiceRef",
      amount,
      method,
      posting_datetime as "postingDatetime",
      doc_status       as "docStatus"
    from public.receipts
    where customer_id = c.id
    order by posting_datetime desc
    limit v_size offset v_page * v_size
  ) t;

  return jsonb_build_object('rows', v_rows, 'total', v_total);
end;
$$;

grant execute on function public.portal_me() to authenticated;
grant execute on function public.portal_invoices(int, int) to authenticated;
grant execute on function public.portal_invoice_detail(text) to authenticated;
grant execute on function public.portal_receipts(int, int) to authenticated;
