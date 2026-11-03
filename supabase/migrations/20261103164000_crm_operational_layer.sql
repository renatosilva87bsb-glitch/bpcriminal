alter table public.customers add column if not exists pipeline_stage text not null default 'new_lead' check (pipeline_stage in ('new_lead','triage','consultation','retained','active_case','closed'));
create table if not exists public.legal_tasks (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 2 and 240), status text not null default 'todo' check(status in ('todo','in_progress','blocked','done')),
 priority text not null default 'normal' check(priority in ('low','normal','high','urgent')), due_at timestamptz,
 assigned_user_id uuid references auth.users(id) on delete set null, related_customer_id uuid references public.customers(id) on delete set null,
 related_case_id uuid references public.legal_cases(id) on delete set null, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists legal_tasks_tenant_due_idx on public.legal_tasks(tenant_id,due_at);
alter table public.legal_tasks enable row level security;
create policy legal_tasks_member_select on public.legal_tasks for select to authenticated using (exists(select 1 from public.tenant_members m where m.tenant_id=legal_tasks.tenant_id and m.user_id=auth.uid()));
create policy legal_tasks_member_insert on public.legal_tasks for insert to authenticated with check (exists(select 1 from public.tenant_members m where m.tenant_id=legal_tasks.tenant_id and m.user_id=auth.uid()));
create policy legal_tasks_member_update on public.legal_tasks for update to authenticated using (exists(select 1 from public.tenant_members m where m.tenant_id=legal_tasks.tenant_id and m.user_id=auth.uid())) with check (exists(select 1 from public.tenant_members m where m.tenant_id=legal_tasks.tenant_id and m.user_id=auth.uid()));
create table if not exists public.legal_audit_events (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade, actor_id uuid references auth.users(id) on delete set null,
 event_type text not null, entity_type text, entity_id uuid, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists legal_audit_tenant_created_idx on public.legal_audit_events(tenant_id,created_at desc);
alter table public.legal_audit_events enable row level security;
create policy legal_audit_member_select on public.legal_audit_events for select to authenticated using (exists(select 1 from public.tenant_members m where m.tenant_id=legal_audit_events.tenant_id and m.user_id=auth.uid()));
