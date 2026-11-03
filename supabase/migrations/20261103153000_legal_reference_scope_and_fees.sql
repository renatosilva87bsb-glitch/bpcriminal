create or replace function public.legal_enforce_tenant_references()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_record jsonb:=to_jsonb(new); v_reference uuid;
begin
  if v_record->>'customer_id' is not null then
    v_reference:=(v_record->>'customer_id')::uuid;
    if not exists(select 1 from public.customers c where c.id=v_reference and c.tenant_id=new.tenant_id) then raise exception 'customer_outside_office' using errcode='23514'; end if;
  end if;
  if v_record->>'case_id' is not null then
    v_reference:=(v_record->>'case_id')::uuid;
    if not exists(select 1 from public.legal_cases c where c.id=v_reference and c.tenant_id=new.tenant_id) then raise exception 'case_outside_office' using errcode='23514'; end if;
  end if;
  if v_record->>'conversation_id' is not null then
    v_reference:=(v_record->>'conversation_id')::uuid;
    if not exists(select 1 from public.conversations c where c.id=v_reference and c.tenant_id=new.tenant_id) then raise exception 'conversation_outside_office' using errcode='23514'; end if;
  end if;
  return new;
end;
$$;
do $$ declare t text; begin
  foreach t in array array['legal_cases','legal_appointments','legal_deadlines','legal_fees','legal_powers_of_attorney','legal_case_movements','legal_contact_events'] loop
    execute format('create trigger enforce_tenant_references before insert or update on public.%I for each row execute function public.legal_enforce_tenant_references()',t);
  end loop;
end; $$;
alter policy legal_fees_select_member on public.legal_fees using (exists(select 1 from public.tenant_members tm where tm.tenant_id=legal_fees.tenant_id and tm.user_id=(select auth.uid()) and tm.role in ('owner','admin','manager')));
alter policy legal_fees_insert_operator on public.legal_fees with check (exists(select 1 from public.tenant_members tm where tm.tenant_id=legal_fees.tenant_id and tm.user_id=(select auth.uid()) and tm.role in ('owner','admin','manager')));
alter policy legal_fees_update_operator on public.legal_fees using (exists(select 1 from public.tenant_members tm where tm.tenant_id=legal_fees.tenant_id and tm.user_id=(select auth.uid()) and tm.role in ('owner','admin','manager'))) with check (exists(select 1 from public.tenant_members tm where tm.tenant_id=legal_fees.tenant_id and tm.user_id=(select auth.uid()) and tm.role in ('owner','admin','manager')));
