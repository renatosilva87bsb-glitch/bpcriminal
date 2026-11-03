-- B&P Advocacia — schema inicial seguro para Supabase
-- Execute em projeto NOVO ou adapte por migration após backup. Não execute sobre produção sem revisão.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- Prevent accidental exposure of objects created by later SQL migrations.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

create table if not exists public.firms (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.firm_memberships (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','admin','lawyer','staff','finance')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (firm_id, user_id)
);

create or replace function private.current_firm_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select fm.firm_id
  from public.firm_memberships fm
  where fm.user_id = (select auth.uid()) and fm.is_active = true
  order by fm.created_at asc
  limit 1
$$;
revoke all on function private.current_firm_id() from public, anon;
grant execute on function private.current_firm_id() to authenticated, service_role;

create or replace function private.current_firm_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select fm.role
  from public.firm_memberships fm
  where fm.user_id = (select auth.uid()) and fm.is_active = true
  order by fm.created_at asc
  limit 1
$$;
revoke all on function private.current_firm_role() from public, anon;
grant execute on function private.current_firm_role() to authenticated, service_role;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null default private.current_firm_id() references public.firms(id),
  created_at timestamptz not null default now(),
  request_id uuid not null unique,
  name text not null,
  phone text not null,
  email text,
  practice_area text not null,
  urgency text not null check (urgency in ('routine','priority','urgent')),
  subject text,
  status text not null default 'Novo' check (status in ('Novo','Contatado','Em análise','Convertido','Descartado','Encerrado')),
  notes text,
  source_ip_hash text,
  consent_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null default private.current_firm_id() references public.firms(id),
  created_at timestamptz not null default now(), name text not null, cpf text, phone text, email text, address text,
  date_of_birth date, status text default 'Ativo', notes text
);
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null default private.current_firm_id() references public.firms(id),
  created_at timestamptz not null default now(), client_name text not null, lawyer text, date_time timestamptz not null,
  type text default 'Consulta inicial', status text default 'Agendado', location text, notes text
);
create table if not exists public.processes (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null default private.current_firm_id() references public.firms(id),
  created_at timestamptz not null default now(), process_number text not null, client_name text not null, crime text,
  court text, judge text, lawyer text, status text default 'Ativo', phase text, open_date date, notes text
);
create table if not exists public.deadlines (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null default private.current_firm_id() references public.firms(id),
  created_at timestamptz not null default now(), title text not null, process_number text, client_name text, lawyer text,
  due_date date not null, type text, done boolean not null default false, notes text
);
create table if not exists public.fees (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null default private.current_firm_id() references public.firms(id),
  created_at timestamptz not null default now(), client_name text not null, process_number text, description text,
  amount numeric(12,2) not null check (amount >= 0), due_date date, paid boolean not null default false,
  paid_date date, payment_method text, notes text
);
create table if not exists public.powers_of_attorney (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null default private.current_firm_id() references public.firms(id),
  created_at timestamptz not null default now(), client_name text not null, lawyer text, scope text,
  issued_date date, expiry_date date, notarized boolean not null default false, notes text
);
create table if not exists public.case_movements (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null default private.current_firm_id() references public.firms(id),
  created_at timestamptz not null default now(), process_number text not null, client_name text, date date not null,
  type text, description text not null, lawyer text, notes text
);

-- Conteúdo público do site; rascunhos só são visíveis à equipe autenticada.
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null default private.current_firm_id() references public.firms(id),
  slug text not null, title text not null, summary text, body text, author_name text, author_oab text,
  category text, status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz, updated_at timestamptz not null default now(), unique(firm_id,slug)
);
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null default private.current_firm_id() references public.firms(id),
  full_name text not null, professional_title text, oab_registration text, biography text, education text,
  practice_areas text[] not null default '{}', photo_path text, is_published boolean not null default false,
  display_order integer not null default 0
);
create table if not exists public.practice_areas (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null default private.current_firm_id() references public.firms(id),
  slug text not null, title text not null, summary text, content text, is_primary boolean not null default false,
  is_published boolean not null default false, display_order integer not null default 0, unique(firm_id,slug)
);
create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(), firm_id uuid not null default private.current_firm_id() references public.firms(id),
  setting_key text not null, setting_value jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now(), unique(firm_id,setting_key)
);

-- Rate limit state for the public intake endpoint. No raw IP is stored.
create table if not exists public.public_lead_rate_limits (
  ip_hash text primary key, window_started_at timestamptz not null default now(), request_count integer not null default 0
);

create or replace function public.create_public_lead(
  p_request_id uuid, p_name text, p_phone text, p_email text, p_practice_area text, p_urgency text, p_ip_hash text
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare v_count integer; v_window timestamptz; v_id uuid; v_firm uuid;
begin
  if p_request_id is null then raise exception 'invalid_request_id'; end if;
  if length(coalesce(p_name,'')) < 2 or length(coalesce(p_name,'')) > 100 then raise exception 'invalid_name'; end if;
  if length(coalesce(p_phone,'')) < 8 or length(coalesce(p_phone,'')) > 25 then raise exception 'invalid_phone'; end if;
  if p_urgency not in ('routine','priority','urgent') then raise exception 'invalid_urgency'; end if;
  if p_practice_area not in ('Direito Criminal','Direito Empresarial','Direito Civil','Direito do Trabalho','Família e Sucessões','Direito Tributário','Direito Previdenciário','Outra / Não sei identificar') then raise exception 'invalid_practice_area'; end if;
  perform pg_advisory_xact_lock(hashtext(p_ip_hash));
  select request_count, window_started_at into v_count, v_window from public.public_lead_rate_limits where ip_hash=p_ip_hash for update;
  if found and v_window > now() - interval '1 hour' and v_count >= 5 then raise exception 'rate_limited'; end if;
  insert into public.public_lead_rate_limits as rl(ip_hash,window_started_at,request_count)
  values(p_ip_hash,now(),1)
  on conflict(ip_hash) do update set
    window_started_at=case when rl.window_started_at <= now()-interval '1 hour' then now() else rl.window_started_at end,
    request_count=case when rl.window_started_at <= now()-interval '1 hour' then 1 else rl.request_count+1 end;
  select id into v_firm from public.firms order by created_at asc limit 1;
  if v_firm is null then raise exception 'firm_not_configured'; end if;
  insert into public.leads(firm_id,request_id,name,phone,email,practice_area,urgency,source_ip_hash,consent_at)
  values(v_firm,p_request_id,trim(p_name),trim(p_phone),nullif(trim(coalesce(p_email,'')),''),p_practice_area,p_urgency,p_ip_hash,now())
  on conflict(request_id) do update set request_id=excluded.request_id
  returning id into v_id;
  return v_id;
end
$$;
revoke all on function public.create_public_lead(uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_public_lead(uuid,text,text,text,text,text,text) to service_role;

-- RLS: every operational record is restricted to the user's active firm.
alter table public.firms enable row level security;
alter table public.firm_memberships enable row level security;
alter table public.leads enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.processes enable row level security;
alter table public.deadlines enable row level security;
alter table public.fees enable row level security;
alter table public.powers_of_attorney enable row level security;
alter table public.case_movements enable row level security;
alter table public.articles enable row level security;
alter table public.team_members enable row level security;
alter table public.practice_areas enable row level security;
alter table public.site_settings enable row level security;
alter table public.public_lead_rate_limits enable row level security;

-- Remove broad default grants, then grant only what the app needs.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.firms, public.firm_memberships to authenticated;
grant select,insert,update,delete on public.leads,public.clients,public.appointments,public.processes,public.deadlines,public.fees,public.powers_of_attorney,public.case_movements,public.articles,public.team_members,public.practice_areas,public.site_settings to authenticated;
grant all on all tables in schema public to service_role;

drop policy if exists "member reads own membership" on public.firm_memberships;
create policy "member reads own membership" on public.firm_memberships for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "member reads own firm" on public.firms;
create policy "member reads own firm" on public.firms for select to authenticated using (id=private.current_firm_id());

do $$ declare t text; begin
  foreach t in array array['leads','clients','appointments','processes','deadlines','fees','powers_of_attorney','case_movements','articles','team_members','practice_areas','site_settings'] loop
    execute format('drop policy if exists %I on public.%I',t||'_member_select',t);
    execute format('drop policy if exists %I on public.%I',t||'_member_insert',t);
    execute format('drop policy if exists %I on public.%I',t||'_member_update',t);
    execute format('drop policy if exists %I on public.%I',t||'_member_delete',t);
    if t = 'fees' then
      execute format('create policy %I on public.%I for select to authenticated using (firm_id=private.current_firm_id() and private.current_firm_role() in (''owner'',''admin'',''finance''))',t||'_member_select',t);
      execute format('create policy %I on public.%I for insert to authenticated with check (firm_id=private.current_firm_id() and private.current_firm_role() in (''owner'',''admin'',''finance''))',t||'_member_insert',t);
      execute format('create policy %I on public.%I for update to authenticated using (firm_id=private.current_firm_id() and private.current_firm_role() in (''owner'',''admin'',''finance'')) with check (firm_id=private.current_firm_id() and private.current_firm_role() in (''owner'',''admin'',''finance''))',t||'_member_update',t);
      execute format('create policy %I on public.%I for delete to authenticated using (firm_id=private.current_firm_id() and private.current_firm_role() in (''owner'',''admin''))',t||'_member_delete',t);
    elsif t = 'site_settings' then
      execute format('create policy %I on public.%I for select to authenticated using (firm_id=private.current_firm_id() and private.current_firm_role() in (''owner'',''admin''))',t||'_member_select',t);
      execute format('create policy %I on public.%I for insert to authenticated with check (firm_id=private.current_firm_id() and private.current_firm_role() in (''owner'',''admin''))',t||'_member_insert',t);
      execute format('create policy %I on public.%I for update to authenticated using (firm_id=private.current_firm_id() and private.current_firm_role() in (''owner'',''admin'')) with check (firm_id=private.current_firm_id() and private.current_firm_role() in (''owner'',''admin''))',t||'_member_update',t);
      execute format('create policy %I on public.%I for delete to authenticated using (firm_id=private.current_firm_id() and private.current_firm_role() in (''owner'',''admin''))',t||'_member_delete',t);
    else
      execute format('create policy %I on public.%I for select to authenticated using (firm_id=private.current_firm_id())',t||'_member_select',t);
      execute format('create policy %I on public.%I for insert to authenticated with check (firm_id=private.current_firm_id())',t||'_member_insert',t);
      execute format('create policy %I on public.%I for update to authenticated using (firm_id=private.current_firm_id()) with check (firm_id=private.current_firm_id())',t||'_member_update',t);
      execute format('create policy %I on public.%I for delete to authenticated using (firm_id=private.current_firm_id() and private.current_firm_role() in (''owner'',''admin''))',t||'_member_delete',t);
    end if;
  end loop;
end $$;

create index if not exists leads_firm_created_idx on public.leads(firm_id,created_at desc);
create index if not exists clients_firm_name_idx on public.clients(firm_id,name);
create index if not exists processes_firm_number_idx on public.processes(firm_id,process_number);
create index if not exists deadlines_firm_due_idx on public.deadlines(firm_id,due_date) where done=false;
create index if not exists appointments_firm_date_idx on public.appointments(firm_id,date_time);
create index if not exists articles_published_idx on public.articles(firm_id,published_at desc) where status='published';

-- IMPORTANT: create the first firm and membership manually after creating the first Auth user.
-- 1) Create the user in Supabase Auth (Dashboard > Authentication > Users).
-- 2) Run:
-- insert into public.firms(legal_name,display_name) values ('RAZÃO SOCIAL VALIDADA','B&P Advocacia') returning id;
-- insert into public.firm_memberships(firm_id,user_id,role) values ('FIRM_UUID','AUTH_USER_UUID','owner');
-- Never enable public sign-up for the internal admin panel unless an invitation workflow is implemented.

-- Web Push: inscrições de notificações internas por usuário autenticado.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (endpoint)
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
create policy push_subscriptions_read_own on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()) and firm_id = (select private.current_firm_id()));
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()) and firm_id = (select private.current_firm_id()));
create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated using (user_id = (select auth.uid()) and firm_id = (select private.current_firm_id()))
  with check (user_id = (select auth.uid()) and firm_id = (select private.current_firm_id()));
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()) and firm_id = (select private.current_firm_id()));
