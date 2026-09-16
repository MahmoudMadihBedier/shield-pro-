-- Phase 4.1 — bank statement import. A System Admin uploads a CSV of the
-- company's bank statement (statement_date,description,reference,debit,
-- credit,balance); the accountant then manually reconciles each line against
-- the app's own receipts/payment vouchers (no auto-matching in v1 — that's a
-- separate, bigger feature if it's ever wanted).
--
-- Incremental migration (schema.ts is not the source of truth for tables
-- added after 0015 — see the note at the top of 0017).
--
-- No client write policy at all: import and reconcile both go through
-- SECURITY DEFINER RPCs (claude.md §6 — financial data). Read is restricted
-- to System Admin + Chief Accountant, not every accountant role — a bank
-- statement is company-wide treasury data, not branch-scoped.

set check_function_bodies = off;

create table if not exists public."bank_statement_lines" (
  "id" text primary key default gen_random_uuid()::text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "statement_date" date not null,
  "description" text not null,
  "reference" text,
  "debit" numeric not null default 0 check ("debit" >= 0),
  "credit" numeric not null default 0 check ("credit" >= 0),
  "balance" numeric,
  "reconciled" boolean not null default false,
  "reconciled_by" text,
  "reconciled_at" timestamptz,
  "imported_by" text not null,
  "batch_ref" text not null
);

create index if not exists "bank_statement_lines_date_idx"
  on public."bank_statement_lines" ("statement_date");
create index if not exists "bank_statement_lines_batch_idx"
  on public."bank_statement_lines" ("batch_ref");
create index if not exists "bank_statement_lines_reconciled_idx"
  on public."bank_statement_lines" ("reconciled");

drop trigger if exists "bank_statement_lines_set_updated_at" on public."bank_statement_lines";
create trigger "bank_statement_lines_set_updated_at" before update on public."bank_statement_lines"
  for each row execute function public.set_updated_at();

alter table public."bank_statement_lines" enable row level security;

create policy "bank_statement_lines_read" on public."bank_statement_lines"
  for select to authenticated
  using (public.has_role('system_admin') or public.has_role('chief_accountant'));

-- ----- import_bank_statement -------------------------------------------------
-- Skips a row that's missing its date/description or has neither a debit nor
-- a credit amount, and skips an exact duplicate of an already-imported line
-- (same date/description/reference/debit/credit) so re-uploading the same
-- file twice can't double every line.
create or replace function public.import_bank_statement(p_rows jsonb)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb;
  v_date date;
  v_desc text;
  v_ref text;
  v_debit numeric;
  v_credit numeric;
  v_balance numeric;
  v_applied int := 0;
  v_skipped int := 0;
  v_batch text := 'BSI-' || to_char(now(), 'YYYYMMDDHH24MISS');
  v_caller text := auth.uid()::text;
begin
  perform public._require_staff();
  if not public.has_role('system_admin') then
    raise exception 'only a System Admin may import a bank statement' using errcode = '42501';
  end if;

  for v_row in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_date := nullif(v_row->>'statement_date', '')::date;
    v_desc := btrim(coalesce(v_row->>'description', ''));
    v_ref := nullif(btrim(coalesce(v_row->>'reference', '')), '');
    v_debit := coalesce(nullif(v_row->>'debit', '')::numeric, 0);
    v_credit := coalesce(nullif(v_row->>'credit', '')::numeric, 0);
    v_balance := nullif(v_row->>'balance', '')::numeric;

    if v_date is null or v_desc = '' or (v_debit = 0 and v_credit = 0)
       or v_debit < 0 or v_credit < 0 then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if exists (
      select 1 from public.bank_statement_lines b
      where b.statement_date = v_date and b.description = v_desc
        and coalesce(b.reference, '') = coalesce(v_ref, '')
        and b.debit = v_debit and b.credit = v_credit
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.bank_statement_lines
      (id, statement_date, description, reference, debit, credit, balance, imported_by, batch_ref)
    values
      (gen_random_uuid()::text, v_date, v_desc, v_ref, v_debit, v_credit, v_balance, v_caller, v_batch);
    v_applied := v_applied + 1;
  end loop;

  perform public._audit('import_bank_statement', 'bank_statement_lines', v_batch, null,
    jsonb_build_object('applied', v_applied, 'skipped', v_skipped));

  return jsonb_build_object('applied', v_applied, 'skipped', v_skipped, 'batchRef', v_batch);
end;
$$;

revoke all on function public.import_bank_statement(jsonb) from public;
grant execute on function public.import_bank_statement(jsonb) to authenticated;

-- ----- set_bank_statement_reconciled -----------------------------------------
create or replace function public.set_bank_statement_reconciled(p_id text, p_reconciled boolean)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r_before jsonb;
  r_after jsonb;
begin
  perform public._require_staff();
  if not (public.has_role('system_admin') or public.has_role('chief_accountant')) then
    raise exception 'only a System Admin or Chief Accountant may reconcile a bank line'
      using errcode = '42501';
  end if;

  select to_jsonb(t) into r_before from public.bank_statement_lines t where t.id = p_id;
  if r_before is null then
    raise exception 'bank statement line % does not exist', p_id using errcode = 'P0002';
  end if;

  update public.bank_statement_lines
  set reconciled = p_reconciled,
      reconciled_by = case when p_reconciled then auth.uid()::text else null end,
      reconciled_at = case when p_reconciled then now() else null end
  where id = p_id
  returning to_jsonb(bank_statement_lines.*) into r_after;

  perform public._audit('set_bank_statement_reconciled', 'bank_statement_lines', p_id, r_before, r_after);
  return r_after;
end;
$$;

revoke all on function public.set_bank_statement_reconciled(text, boolean) from public;
grant execute on function public.set_bank_statement_reconciled(text, boolean) to authenticated;
