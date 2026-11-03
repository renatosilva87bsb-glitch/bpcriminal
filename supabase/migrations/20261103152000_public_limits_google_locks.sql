create table if not exists public.legal_public_rate_limits (
  bucket_hash text not null,
  window_start timestamptz not null,
  request_count integer not null,
  primary key(bucket_hash,window_start)
);
alter table public.legal_public_rate_limits enable row level security;
revoke all on public.legal_public_rate_limits from anon,authenticated;
grant all on public.legal_public_rate_limits to service_role;
create or replace function public.consume_public_lead_limit(p_bucket text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if p_bucket is null or length(p_bucket)<>64 then raise exception 'invalid_bucket'; end if;
  delete from public.legal_public_rate_limits where window_start < now()-interval '1 day';
  insert into public.legal_public_rate_limits(bucket_hash,window_start,request_count)
  values(p_bucket,date_trunc('minute',now()),1)
  on conflict(bucket_hash,window_start) do update set request_count=public.legal_public_rate_limits.request_count+1
  returning request_count into v_count;
  return v_count<=5;
end;
$$;
revoke all on function public.consume_public_lead_limit(text) from public,anon,authenticated;
grant execute on function public.consume_public_lead_limit(text) to service_role;

create table if not exists public.google_operation_locks (
  lock_key text primary key,
  lease_id uuid not null,
  expires_at timestamptz not null
);
alter table public.google_operation_locks enable row level security;
revoke all on public.google_operation_locks from anon,authenticated;
grant all on public.google_operation_locks to service_role;
create or replace function public.acquire_google_operation_lock(p_key text,p_lease uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_lease uuid;
begin
  insert into public.google_operation_locks(lock_key,lease_id,expires_at)
  values(p_key,p_lease,now()+interval '2 minutes')
  on conflict(lock_key) do update set lease_id=excluded.lease_id,expires_at=excluded.expires_at
  where public.google_operation_locks.expires_at<now()
  returning lease_id into v_lease;
  return v_lease=p_lease;
end;
$$;
revoke all on function public.acquire_google_operation_lock(text,uuid) from public,anon,authenticated;
grant execute on function public.acquire_google_operation_lock(text,uuid) to service_role;
