create or replace function public.consume_ai_rate_limit(p_tenant_id uuid, p_limit integer default 20)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_window timestamptz := date_trunc('minute',now());
  v_count integer;
begin
  if v_user_id is null or p_limit < 1 or p_limit > 20 then
    raise exception 'invalid_request' using errcode='22023';
  end if;
  if not exists(select 1 from public.tenant_members tm where tm.tenant_id=p_tenant_id and tm.user_id=v_user_id and tm.role in ('owner','admin','manager','agent')) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  insert into public.ai_request_limits(tenant_id,user_id,window_start,request_count)
  values(p_tenant_id,v_user_id,v_window,1)
  on conflict(tenant_id,user_id,window_start) do update set request_count=public.ai_request_limits.request_count+1
  returning request_count into v_count;
  return v_count <= p_limit;
end;
$$;
revoke all on function public.consume_ai_rate_limit(uuid,integer) from public,anon;
grant execute on function public.consume_ai_rate_limit(uuid,integer) to authenticated;
