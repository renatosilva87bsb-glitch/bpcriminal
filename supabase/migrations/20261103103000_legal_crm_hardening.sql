-- CRM jurídico: dados operacionais adicionais, histórico de contato sem conteúdo sigiloso,
-- logs de IA sem prompts/respostas e checklist de segurança por tenant.

alter table public.customers
  add column if not exists lead_source text,
  add column if not exists lead_urgency text check (lead_urgency is null or lead_urgency in ('urgent','priority','routine'));

create table if not exists public.legal_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  process_number text,
  title text not null check (char_length(trim(title)) between 2 and 240),
  crime text,
  court text,
  judge text,
  responsible_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active','awaiting_judgment','closed','appeal','archived')),
  phase text check (phase is null or phase in ('investigation','indictment','instruction','closing_arguments','sentence','appeal','execution')),
  opened_on date,
  notes text check (notes is null or char_length(notes) <= 5000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_deadlines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  case_id uuid references public.legal_cases(id) on delete set null,
  title text not null check (char_length(trim(title)) between 2 and 240),
  due_at timestamptz not null,
  kind text not null default 'processual' check (kind in ('processual','legal','hearing','other')),
  responsible_user_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 3000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  case_id uuid references public.legal_cases(id) on delete set null,
  title text not null check (char_length(trim(title)) between 2 and 240),
  starts_at timestamptz not null,
  kind text not null default 'initial_consultation' check (kind in ('initial_consultation','follow_up','urgency','video','hearing','other')),
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','completed','cancelled')),
  location text,
  responsible_user_id uuid references auth.users(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 3000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_fees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  case_id uuid references public.legal_cases(id) on delete set null,
  description text not null check (char_length(trim(description)) between 2 and 240),
  amount_cents integer not null check (amount_cents >= 0),
  due_on date,
  paid_at timestamptz,
  payment_method text check (payment_method is null or payment_method in ('pix','ted','boleto','cash','card','other')),
  notes text check (notes is null or char_length(notes) <= 3000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_powers_of_attorney (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  responsible_user_id uuid references auth.users(id) on delete set null,
  scope text not null default 'ad_judicia' check (scope in ('ad_judicia','ad_negocia','full','special')),
  issued_on date,
  expires_on date,
  notarized boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 3000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_case_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  case_id uuid references public.legal_cases(id) on delete cascade,
  process_number text,
  moved_on date not null,
  kind text not null default 'other' check (kind in ('order','decision','sentence','judgment','service','filing','citation','other')),
  description text not null check (char_length(trim(description)) between 2 and 1000),
  responsible_user_id uuid references auth.users(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 3000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.legal_contact_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp','phone','email','web','other')),
  direction text not null check (direction in ('inbound','outbound','internal')),
  event_type text not null default 'contact' check (event_type in ('contact','handoff','callback','appointment','note','consent','opt_out')),
  safe_summary text not null check (char_length(trim(safe_summary)) between 2 and 500),
  external_ref text,
  created_at timestamptz not null default now()
);

create table if not exists public.legal_ai_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  mode text not null check (mode in ('triage','summary','deadline_plan','internal_draft')),
  model text not null,
  input_sha256 text not null,
  output_sha256 text,
  status text not null check (status in ('completed','rejected','failed')),
  latency_ms integer,
  human_review_required boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists legal_cases_tenant_updated_idx on public.legal_cases(tenant_id, updated_at desc);
create index if not exists legal_deadlines_tenant_due_idx on public.legal_deadlines(tenant_id, due_at asc) where completed_at is null;
create index if not exists legal_appointments_tenant_start_idx on public.legal_appointments(tenant_id, starts_at asc);
create index if not exists legal_contact_events_tenant_created_idx on public.legal_contact_events(tenant_id, created_at desc);
create index if not exists legal_ai_runs_tenant_created_idx on public.legal_ai_runs(tenant_id, created_at desc);

alter table public.legal_cases enable row level security;
alter table public.legal_deadlines enable row level security;
alter table public.legal_appointments enable row level security;
alter table public.legal_fees enable row level security;
alter table public.legal_powers_of_attorney enable row level security;
alter table public.legal_case_movements enable row level security;
alter table public.legal_contact_events enable row level security;
alter table public.legal_ai_runs enable row level security;

-- Membros conseguem consultar dados do próprio escritório; edição fica restrita a perfis operacionais.
do $$
declare
  t text;
begin
  foreach t in array array['legal_cases','legal_deadlines','legal_appointments','legal_fees','legal_powers_of_attorney','legal_case_movements','legal_contact_events'] loop
    execute format('drop policy if exists %I on public.%I', t||'_select_member', t);
    execute format('drop policy if exists %I on public.%I', t||'_insert_operator', t);
    execute format('drop policy if exists %I on public.%I', t||'_update_operator', t);
    execute format('drop policy if exists %I on public.%I', t||'_delete_admin', t);
    execute format('create policy %I on public.%I for select to authenticated using (exists (select 1 from public.tenant_members tm where tm.tenant_id=%I.tenant_id and tm.user_id=(select auth.uid())))', t||'_select_member', t, t);
    execute format('create policy %I on public.%I for insert to authenticated with check (exists (select 1 from public.tenant_members tm where tm.tenant_id=%I.tenant_id and tm.user_id=(select auth.uid()) and tm.role in (''owner'',''admin'',''manager'',''agent'')))', t||'_insert_operator', t, t);
    execute format('create policy %I on public.%I for update to authenticated using (exists (select 1 from public.tenant_members tm where tm.tenant_id=%I.tenant_id and tm.user_id=(select auth.uid()) and tm.role in (''owner'',''admin'',''manager'',''agent''))) with check (exists (select 1 from public.tenant_members tm where tm.tenant_id=%I.tenant_id and tm.user_id=(select auth.uid()) and tm.role in (''owner'',''admin'',''manager'',''agent'')))', t||'_update_operator', t, t, t);
    execute format('create policy %I on public.%I for delete to authenticated using (exists (select 1 from public.tenant_members tm where tm.tenant_id=%I.tenant_id and tm.user_id=(select auth.uid()) and tm.role in (''owner'',''admin'')))', t||'_delete_admin', t, t);
  end loop;
end $$;

drop policy if exists legal_ai_runs_select_admin_lawyer on public.legal_ai_runs;
create policy legal_ai_runs_select_admin_lawyer on public.legal_ai_runs for select to authenticated using (exists (select 1 from public.tenant_members tm where tm.tenant_id=legal_ai_runs.tenant_id and tm.user_id=(select auth.uid()) and tm.role in ('owner','admin','manager','agent')));

revoke all on public.legal_ai_runs from anon, authenticated;
grant select on public.legal_ai_runs to authenticated;
grant all on public.legal_ai_runs to service_role;

grant select, insert, update, delete on public.legal_cases, public.legal_deadlines, public.legal_appointments, public.legal_fees, public.legal_powers_of_attorney, public.legal_case_movements, public.legal_contact_events to authenticated;
grant all on public.legal_cases, public.legal_deadlines, public.legal_appointments, public.legal_fees, public.legal_powers_of_attorney, public.legal_case_movements, public.legal_contact_events to service_role;
