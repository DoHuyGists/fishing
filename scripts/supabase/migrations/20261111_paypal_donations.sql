-- Run before deploying the PayPal Edge Functions. No game rewards are granted.
create table if not exists public.donations (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  amount_cents integer not null check (amount_cents between 100 and 100000),
  currency text not null default 'USD' check (currency = 'USD'),
  paypal_order_id text unique,
  paypal_capture_id text unique,
  status text not null default 'CREATED' check (status in
    ('CREATED', 'APPROVED', 'PENDING', 'COMPLETED', 'DECLINED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'REVERSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists donations_user_created_idx on public.donations(user_id, created_at desc);
alter table public.donations enable row level security;
revoke all on public.donations from anon, authenticated;
grant select on public.donations to authenticated;
grant all on public.donations to service_role;
drop policy if exists donations_select_own on public.donations;
create policy donations_select_own on public.donations for select to authenticated using (user_id = (select auth.uid()));

-- Serialize attempts per user to make the creation limit effective under concurrency.
create or replace function public.prepare_paypal_donation(p_id uuid, p_user_id uuid, p_amount_cents integer)
returns public.donations language plpgsql security definer set search_path = '' as $$
declare v_row public.donations;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into v_row from public.donations where id = p_id;
  if found then
    if v_row.user_id <> p_user_id or v_row.amount_cents <> p_amount_cents then
      raise exception 'Attempt mismatch';
    end if;
    return v_row;
  end if;
  if (select count(*) from public.donations where user_id = p_user_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Donation attempt limit reached';
  end if;
  insert into public.donations(id, user_id, amount_cents) values (p_id, p_user_id, p_amount_cents) returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.prepare_paypal_donation(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.prepare_paypal_donation(uuid, uuid, integer) to service_role;

-- Prevent delayed/repeated webhook responses from rolling back a settled state.
create or replace function public.record_paypal_donation(p_id uuid, p_capture_id text, p_status text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_row public.donations;
begin
  select * into strict v_row from public.donations where id = p_id for update;
  if v_row.paypal_capture_id is not null and v_row.paypal_capture_id <> p_capture_id then
    raise exception 'Capture mismatch';
  end if;
  if v_row.status in ('REFUNDED', 'REVERSED')
    or (v_row.status = 'PARTIALLY_REFUNDED' and p_status not in ('REFUNDED', 'REVERSED'))
    or (v_row.status = 'COMPLETED' and p_status in ('CREATED', 'APPROVED', 'PENDING'))
    or (v_row.status in ('DECLINED', 'FAILED') and p_status in ('CREATED', 'APPROVED', 'PENDING'))
    or (v_row.status = 'PENDING' and p_status in ('CREATED', 'APPROVED')) then
    return v_row.status;
  end if;
  update public.donations set paypal_capture_id = coalesce(p_capture_id, paypal_capture_id),
    status = p_status, updated_at = now() where id = p_id;
  return p_status;
end;
$$;
revoke all on function public.record_paypal_donation(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_paypal_donation(uuid, text, text) to service_role;
