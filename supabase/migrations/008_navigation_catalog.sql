-- Explicit current navigation; legacy categories/materials remain intact.
begin;
select pg_advisory_xact_lock(1045,8);
create table if not exists private.a45_navigation(singleton boolean primary key default true check(singleton),entries jsonb not null,revision integer not null default 1);
alter table private.a45_navigation enable row level security;
revoke all on private.a45_navigation from public,anon,authenticated;
create or replace function public.get_a45_navigation() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('entries',entries,'revision',revision) from private.a45_navigation where singleton),jsonb_build_object('entries',null,'revision',0));
$$;
create or replace function public.save_a45_navigation(entries jsonb,expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous integer;
begin
 if not public.is_a45_admin() then raise exception 'Administrator required'; end if;
 perform pg_advisory_xact_lock(1045,8);
 if entries is null or expected_revision is null or expected_revision<0 or jsonb_typeof(entries)<>'array' or jsonb_array_length(entries)>500 then raise exception 'Invalid navigation'; end if;
 if exists(select 1 from jsonb_array_elements(entries) e group by e->>'id' having count(*)>1) then raise exception 'Duplicate navigation ID'; end if;
 if exists(select 1 from jsonb_array_elements(entries) e left join public.categories c on c.id=e->>'id' where c.id is null or not c.is_published or c.parent_id is distinct from nullif(e->>'parentId','')) then raise exception 'Navigation category or parent not found'; end if;
 if exists(select 1 from jsonb_array_elements(entries) e where nullif(e->>'parentId','') is not null and not exists(select 1 from jsonb_array_elements(entries) p where p->>'id'=e->>'parentId')) then raise exception 'Navigation parent is missing'; end if;
 select revision into previous from private.a45_navigation where singleton;
 if coalesce(previous,0)<>expected_revision then raise exception 'Navigation changed in another session'; end if;
 insert into private.a45_navigation values(true,entries,coalesce(previous,0)+1) on conflict(singleton) do update set entries=excluded.entries,revision=excluded.revision;
 return public.get_a45_navigation();
end;
$$;
revoke all on function public.get_a45_navigation(),public.save_a45_navigation(jsonb,integer) from public;
grant execute on function public.get_a45_navigation() to anon,authenticated;
grant execute on function public.save_a45_navigation(jsonb,integer) to authenticated;
commit;
