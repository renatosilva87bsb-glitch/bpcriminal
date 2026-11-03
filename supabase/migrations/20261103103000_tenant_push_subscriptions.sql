create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_self_access on public.push_subscriptions;
create policy push_subscriptions_self_access on public.push_subscriptions
for all to authenticated
using (user_id=(select auth.uid()) and exists (select 1 from public.tenant_members tm where tm.tenant_id=push_subscriptions.tenant_id and tm.user_id=(select auth.uid())))
with check (user_id=(select auth.uid()) and exists (select 1 from public.tenant_members tm where tm.tenant_id=push_subscriptions.tenant_id and tm.user_id=(select auth.uid())));

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
