-- Administradores autorizados pelo escritório B&P Advocacia.
-- O login continua sendo individual; a lista apenas vincula o usuário autenticado
-- ao tenant correto no primeiro login Google.
create table if not exists public.legal_admin_allowlist (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role = 'admin'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);

alter table public.legal_admin_allowlist enable row level security;
revoke all on public.legal_admin_allowlist from public, anon, authenticated;
grant all on public.legal_admin_allowlist to service_role;

insert into public.legal_admin_allowlist (tenant_id, email, role)
values
  ('b26ea3a4-b030-42ca-a941-39aacd7a98c1', lower('diegobandeira.ad@gmail.com'), 'admin'),
  ('b26ea3a4-b030-42ca-a941-39aacd7a98c1', lower('antoniojuniorajadv@gmail.com'), 'admin'),
  ('b26ea3a4-b030-42ca-a941-39aacd7a98c1', lower('Silvaiesb29@gmail.com'), 'admin'),
  ('b26ea3a4-b030-42ca-a941-39aacd7a98c1', lower('lmprado.dz23@gmail.com'), 'admin')
on conflict (tenant_id, email) do update set role = excluded.role, active = true;

create or replace function public.legal_auto_provision_admin(p_user_id uuid, p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_role text;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  select tenant_id, role into v_tenant, v_role
  from public.legal_admin_allowlist
  where email = v_email and active = true
  order by created_at asc
  limit 1;

  if v_tenant is null then
    return false;
  end if;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (v_tenant, p_user_id, v_role)
  on conflict (tenant_id, user_id) do update set role = excluded.role;

  return true;
end;
$$;

revoke all on function public.legal_auto_provision_admin(uuid, text) from public, anon, authenticated;
grant execute on function public.legal_auto_provision_admin(uuid, text) to service_role;
