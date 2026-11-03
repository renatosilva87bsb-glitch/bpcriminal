create table if not exists public.legal_team_chats (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null default 'direct' check (kind in ('direct','group')),
  name text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table if not exists public.legal_team_chat_members (
  chat_id uuid not null references public.legal_team_chats(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (chat_id,user_id)
);
create table if not exists public.legal_team_chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  chat_id uuid not null references public.legal_team_chats(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 8000),
  attachment_name text,
  attachment_url text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists legal_chat_messages_idx on public.legal_team_chat_messages(chat_id,created_at desc);
create index if not exists legal_chat_members_user_idx on public.legal_team_chat_members(tenant_id,user_id);
alter table public.legal_team_chats enable row level security;
alter table public.legal_team_chat_members enable row level security;
alter table public.legal_team_chat_messages enable row level security;
revoke all on public.legal_team_chats,public.legal_team_chat_members,public.legal_team_chat_messages from anon;
grant select,insert,update on public.legal_team_chats,public.legal_team_chat_members,public.legal_team_chat_messages to authenticated;
grant all on public.legal_team_chats,public.legal_team_chat_members,public.legal_team_chat_messages to service_role;

create or replace function public.legal_team_directory(p_tenant_id uuid)
returns table(user_id uuid,email text,role text)
language sql security definer set search_path=''
as $$ select u.id,u.email,tm.role from auth.users u join public.tenant_members tm on tm.user_id=u.id where tm.tenant_id=p_tenant_id and exists(select 1 from public.tenant_members me where me.tenant_id=p_tenant_id and me.user_id=auth.uid()) order by u.email limit 100 $$;

create or replace function public.legal_create_team_chat(p_tenant_id uuid,p_kind text,p_name text,p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_chat uuid; v_id uuid; begin if not exists(select 1 from public.tenant_members where tenant_id=p_tenant_id and user_id=auth.uid()) then raise exception 'forbidden'; end if; if p_kind not in ('direct','group') then raise exception 'invalid_kind'; end if; insert into public.legal_team_chats(tenant_id,kind,name,created_by) values(p_tenant_id,p_kind,nullif(trim(p_name),''),auth.uid()) returning id into v_chat; insert into public.legal_team_chat_members(chat_id,tenant_id,user_id) values(v_chat,p_tenant_id,auth.uid()); foreach v_id in array coalesce(p_member_ids,'{}'::uuid[]) loop if exists(select 1 from public.tenant_members where tenant_id=p_tenant_id and user_id=v_id) then insert into public.legal_team_chat_members(chat_id,tenant_id,user_id) values(v_chat,p_tenant_id,v_id) on conflict do nothing; end if; end loop; return v_chat; end $$;

create or replace function public.legal_team_chat_list(p_tenant_id uuid)
returns table(chat_id uuid,kind text,name text,unread_count bigint,last_message text,last_at timestamptz)
language sql security definer set search_path=''
as $$ select c.id,c.kind,c.name,count(m.id) filter(where m.created_at>coalesce(cm.last_read_at,'epoch'::timestamptz) and m.sender_id<>auth.uid()),(array_agg(m.body order by m.created_at desc))[1],max(m.created_at) from public.legal_team_chats c join public.legal_team_chat_members cm on cm.chat_id=c.id and cm.user_id=auth.uid() left join public.legal_team_chat_messages m on m.chat_id=c.id and m.deleted_at is null where c.tenant_id=p_tenant_id group by c.id,c.kind,c.name order by max(m.created_at) desc nulls last limit 100 $$;

create or replace function public.legal_team_chat_messages(p_chat_id uuid)
returns table(id uuid,sender_id uuid,sender_email text,body text,attachment_name text,attachment_url text,created_at timestamptz)
language sql security definer set search_path=''
as $$ select m.id,m.sender_id,u.email,m.body,m.attachment_name,m.attachment_url,m.created_at from public.legal_team_chat_messages m join auth.users u on u.id=m.sender_id where m.chat_id=p_chat_id and exists(select 1 from public.legal_team_chat_members cm where cm.chat_id=p_chat_id and cm.user_id=auth.uid()) and m.deleted_at is null order by m.created_at asc limit 200 $$;

create or replace function public.legal_send_team_message(p_chat_id uuid,p_body text,p_attachment_name text,p_attachment_url text)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid; v_tenant uuid; begin select tenant_id into v_tenant from public.legal_team_chats where id=p_chat_id and exists(select 1 from public.legal_team_chat_members where chat_id=p_chat_id and user_id=auth.uid()); if v_tenant is null then raise exception 'forbidden'; end if; insert into public.legal_team_chat_messages(tenant_id,chat_id,sender_id,body,attachment_name,attachment_url) values(v_tenant,p_chat_id,auth.uid(),trim(p_body),nullif(p_attachment_name,''),nullif(p_attachment_url,'')) returning id into v_id; return v_id; end $$;

create or replace function public.legal_mark_team_chat_read(p_chat_id uuid)
returns boolean language sql security definer set search_path=''
as $$ update public.legal_team_chat_members set last_read_at=now() where chat_id=p_chat_id and user_id=auth.uid() returning true $$;

revoke all on function public.legal_team_directory(uuid),public.legal_create_team_chat(uuid,text,text,uuid[]),public.legal_team_chat_list(uuid),public.legal_team_chat_messages(uuid),public.legal_send_team_message(uuid,text,text,text),public.legal_mark_team_chat_read(uuid) from public,anon;
grant execute on function public.legal_team_directory(uuid),public.legal_create_team_chat(uuid,text,text,uuid[]),public.legal_team_chat_list(uuid),public.legal_team_chat_messages(uuid),public.legal_send_team_message(uuid,text,text,text),public.legal_mark_team_chat_read(uuid) to authenticated;
