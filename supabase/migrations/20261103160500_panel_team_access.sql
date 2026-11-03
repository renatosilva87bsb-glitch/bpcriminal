create or replace function public.legal_manage_team_access(p_tenant_id uuid, p_email text, p_role text, p_active boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_user uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_existing text;
begin
  select tm.role into v_actor_role
  from public.tenant_members tm
  where tm.tenant_id = p_tenant_id and tm.user_id = auth.uid()
  limit 1;

  if v_actor_role is null or v_actor_role not in ('owner','admin') then raise exception 'forbidden'; end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid_email'; end if;
  if p_role not in ('admin','manager','agent','viewer') then raise exception 'invalid_role'; end if;

  select u.id into v_user from auth.users u where lower(u.email) = v_email limit 1;
  if v_user = auth.uid() and not p_active then raise exception 'cannot_edit_self'; end if;

  insert into public.legal_admin_allowlist (tenant_id, email, role, active)
  values (p_tenant_id, v_email, p_role, p_active)
  on conflict (tenant_id, email) do update set role = excluded.role, active = excluded.active;

  if v_user is not null and p_active then
    insert into public.tenant_members (tenant_id, user_id, role)
    values (p_tenant_id, v_user, p_role)
    on conflict (tenant_id, user_id) do update set role = excluded.role;
  elsif v_user is not null and not p_active then
    select tm.role into v_existing from public.tenant_members tm where tm.tenant_id = p_tenant_id and tm.user_id = v_user limit 1;
    if v_existing = 'owner' then raise exception 'cannot_edit_owner'; end if;
    delete from public.tenant_members where tenant_id = p_tenant_id and user_id = v_user;
  end if;

  return true;
end;
$$;

create or replace function public.legal_team_access(p_tenant_id uuid)
returns table(email text, role text, active boolean, registered boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
begin
  select tm.role into v_actor_role from public.tenant_members tm where tm.tenant_id = p_tenant_id and tm.user_id = auth.uid() limit 1;
  if v_actor_role is null or v_actor_role not in ('owner','admin') then raise exception 'forbidden'; end if;
  return query
    select a.email, a.role, a.active, exists(select 1 from auth.users u where lower(u.email) = a.email)
    from public.legal_admin_allowlist a
    where a.tenant_id = p_tenant_id
    order by a.email
    limit 100;
end;
$$;

revoke all on function public.legal_manage_team_access(uuid,text,text,boolean) from public, anon;
revoke all on function public.legal_team_access(uuid) from public, anon;
grant execute on function public.legal_manage_team_access(uuid,text,text,boolean), public.legal_team_access(uuid) to authenticated;
