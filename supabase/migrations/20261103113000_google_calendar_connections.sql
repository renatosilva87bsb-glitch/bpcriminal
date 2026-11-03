create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  google_email text,
  calendar_id text not null default 'primary',
  refresh_token_ciphertext text not null,
  token_scope text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

create table if not exists public.google_calendar_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.google_calendar_connections(id) on delete cascade,
  appointment_id uuid not null references public.legal_appointments(id) on delete cascade,
  google_event_id text not null,
  last_synced_at timestamptz not null default now(),
  unique (connection_id, appointment_id),
  unique (connection_id, google_event_id)
);

alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_events enable row level security;
revoke all on public.google_calendar_connections, public.google_calendar_events from anon, authenticated;
grant all on public.google_calendar_connections, public.google_calendar_events to service_role;
create index if not exists google_calendar_connections_user_idx on public.google_calendar_connections(user_id, tenant_id);
create index if not exists google_calendar_events_appointment_idx on public.google_calendar_events(appointment_id);

alter table public.google_calendar_connections add column if not exists drive_folder_id text;
