create table if not exists public.google_contact_links (
  connection_id uuid not null references public.google_calendar_connections(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  resource_name text not null,
  updated_at timestamptz not null default now(),
  primary key(connection_id, customer_id)
);
alter table public.google_contact_links enable row level security;
revoke all on public.google_contact_links from anon, authenticated;
grant all on public.google_contact_links to service_role;
