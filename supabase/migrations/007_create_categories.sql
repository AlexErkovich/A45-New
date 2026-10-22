-- Additive, repeat-safe API for creating sections. Existing rows and permissions stay intact.
begin;
select pg_advisory_xact_lock(1045,7);
create or replace function public.create_a45_category(doc jsonb) returns public.categories
language plpgsql security definer set search_path='' as $$
declare result public.categories; target text:=doc->>'id'; parent text:=nullif(doc->>'parentId','');
begin
 if not public.is_a45_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if target is null or target !~ '^[a-z0-9][a-z0-9-]*$' then raise exception 'Invalid section id'; end if;
 lock table public.categories in share row exclusive mode;
 select * into result from public.categories where id=target;
 if found then
  if result.parent_id is distinct from parent then raise exception 'Section parent conflict'; end if;
  return result;
 end if;
 if parent is not null and not exists(select 1 from public.categories where id=parent and is_published) then raise exception 'Parent section not found'; end if;
 insert into public.categories(id,parent_id,slug,title,description,cover_image_path,sort_order,is_published)
 values(target,parent,target,trim(doc->>'title'),coalesce(doc->>'description',''),nullif(doc->>'coverPath',''),
 coalesce((select max(sort_order)+1 from public.categories where parent_id is not distinct from parent),0),nullif(doc->>'coverPath','') is null)
 returning * into result;
 return result;
end;
$$;
revoke all on function public.create_a45_category(jsonb) from public,anon;
grant execute on function public.create_a45_category(jsonb) to authenticated;
create or replace function public.publish_a45_category(category_id text) returns public.categories
language plpgsql security definer set search_path='' as $$
declare result public.categories;
begin
 if not public.is_a45_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 select * into result from public.categories where id=category_id for update;
 if not found then raise exception 'Section not found'; end if;
 if result.cover_image_path is not null and not exists(select 1 from storage.objects where bucket_id='category-covers' and name=result.cover_image_path) then raise exception 'Section cover is not uploaded'; end if;
 update public.categories set is_published=true where id=category_id returning * into result;
 return result;
end;
$$;
revoke all on function public.publish_a45_category(text) from public,anon;
grant execute on function public.publish_a45_category(text) to authenticated;
insert into private.a45_schema_migrations(version) values('007_create_categories') on conflict do nothing;
notify pgrst, 'reload schema';
commit;
