create table private.retention_holds (
 ticket_id uuid primary key references public.tickets(id) on delete cascade,
 reason text not null check(char_length(reason) between 10 and 1000),
 until_at timestamptz not null
);
create table private.retention_runs (
 id uuid primary key default gen_random_uuid(),started_at timestamptz not null default now(),
 tickets_deleted integer not null,acceptances_deleted integer not null,requests_deleted integer not null
);
revoke all on private.retention_holds,private.retention_runs from public,anon,authenticated;
grant usage on schema private to service_role;
grant all on private.retention_holds,private.retention_runs to service_role;
create function public.run_privacy_retention(p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path='' as $$
declare candidate record; v_ticket uuid; v_tickets integer:=0; v_acceptances integer; v_requests integer;
begin
 if p_limit is null or p_limit not between 1 and 500 then raise exception '422:Limite inválido.'; end if;
 for candidate in select id,organization_id from public.tickets t where status='resolved' and updated_at<now()-interval '12 months'
   and not exists(select 1 from private.retention_holds h where h.ticket_id=t.id and h.until_at>now()) order by organization_id,id limit p_limit
 loop
  perform 1 from public.organizations where id=candidate.organization_id for update;
  v_ticket:=null;
  select id into v_ticket from public.tickets t where id=candidate.id and status='resolved' and updated_at<now()-interval '12 months'
   and not exists(select 1 from private.retention_holds h where h.ticket_id=t.id and h.until_at>now()) for update;
  if v_ticket is not null then
   delete from public.comments where ticket_id=v_ticket;
   delete from public.ticket_events where ticket_id=v_ticket;
   delete from public.tickets where id=v_ticket;
   v_tickets:=v_tickets+1;
  end if;
 end loop;
 delete from public.legal_acceptances where id in (select id from public.legal_acceptances where delete_after<now() order by delete_after limit p_limit);
 get diagnostics v_acceptances=row_count;
 delete from public.privacy_requests where id in (select id from public.privacy_requests where delete_after<now() order by delete_after limit p_limit);
 get diagnostics v_requests=row_count;
 delete from private.retention_runs where started_at<now()-interval '90 days';
 insert into private.retention_runs(tickets_deleted,acceptances_deleted,requests_deleted) values(v_tickets,v_acceptances,v_requests);
 return jsonb_build_object('tickets',v_tickets,'acceptances',v_acceptances,'requests',v_requests);
end;
$$;
revoke all on function public.run_privacy_retention(integer) from public,anon,authenticated;
grant execute on function public.run_privacy_retention(integer) to service_role;
