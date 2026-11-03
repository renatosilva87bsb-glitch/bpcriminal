create or replace function public.legal_team_members()
returns table(user_id uuid,email text,role text)
language plpgsql security definer set search_path='' as $$
declare v_tenant uuid; v_role text;
begin
  select tm.tenant_id,tm.role into v_tenant,v_role from public.tenant_members tm where tm.user_id=auth.uid() order by tm.created_at asc limit 1;
  if v_role is null or v_role not in ('owner','admin') then raise exception 'forbidden' using errcode='42501'; end if;
  return query select tm.user_id,u.email::text,tm.role from public.tenant_members tm join auth.users u on u.id=tm.user_id where tm.tenant_id=v_tenant order by tm.created_at limit 100;
end;
$$;
create or replace function public.legal_link_existing_member(p_email text,p_role text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_tenant uuid; v_actor_role text; v_user uuid; v_existing text;
begin
  select tm.tenant_id,tm.role into v_tenant,v_actor_role from public.tenant_members tm where tm.user_id=auth.uid() order by tm.created_at asc limit 1;
  if v_actor_role is null or v_actor_role not in ('owner','admin') then raise exception 'forbidden' using errcode='42501'; end if;
  if p_role not in ('admin','manager','agent','viewer') then raise exception 'invalid_role'; end if;
  select u.id into v_user from auth.users u where lower(u.email)=lower(trim(p_email)) limit 1;
  if v_user is null then raise exception 'account_not_registered'; end if;
  if v_user=auth.uid() then raise exception 'cannot_edit_self'; end if;
  select tm.role into v_existing from public.tenant_members tm where tm.user_id=v_user and tm.tenant_id=v_tenant limit 1;
  if v_existing='owner' then raise exception 'cannot_edit_owner'; end if;
  insert into public.tenant_members(tenant_id,user_id,role) values(v_tenant,v_user,p_role)
  on conflict(tenant_id,user_id) do update set role=excluded.role;
  return true;
end;
$$;
revoke all on function public.legal_team_members() from public,anon;
revoke all on function public.legal_link_existing_member(text,text) from public,anon;
grant execute on function public.legal_team_members(), public.legal_link_existing_member(text,text) to authenticated;
