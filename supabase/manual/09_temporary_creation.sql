-- Temporary browser-owned creation without a login. Original admin permissions remain intact.
begin;
select pg_advisory_xact_lock(1045,9);
create table if not exists private.a45_creation_mode(singleton boolean primary key default true check(singleton),enabled boolean not null default true);
insert into private.a45_creation_mode values(true,true) on conflict(singleton) do update set enabled=true;
create table if not exists private.a45_browser_items(kind text not null check(kind in ('category','project')),id text not null,key_hash text not null,primary key(kind,id));
alter table private.a45_creation_mode enable row level security;
alter table private.a45_browser_items enable row level security;
revoke all on private.a45_creation_mode,private.a45_browser_items from public,anon,authenticated;
create or replace function private.a45_browser_key() returns text language sql stable set search_path='' as $$
 select coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-a45-creation-key','');
$$;
create or replace function public.a45_browser_owns(item_kind text,item_id text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.a45_creation_mode where enabled) and exists(select 1 from private.a45_browser_items where kind=item_kind and id=item_id and key_hash=md5(private.a45_browser_key()));
$$;
revoke all on function private.a45_browser_key() from public,anon,authenticated;
revoke all on function public.a45_browser_owns(text,text) from public;
grant execute on function public.a45_browser_owns(text,text) to anon,authenticated;
create or replace function private.a45_claim_browser_item(item_kind text,item_id text) returns void language plpgsql security definer set search_path='' as $$
declare k text:=private.a45_browser_key();
begin
 if not exists(select 1 from private.a45_creation_mode where enabled) then raise exception 'Temporary creation is disabled'; end if;
 if k !~ '^[a-f0-9-]{72}$' then raise exception 'Creation key is missing'; end if;
 perform pg_advisory_xact_lock(hashtextextended(item_kind||':'||item_id,1045));
 if exists(select 1 from private.a45_browser_items where kind=item_kind and id=item_id) then
  if not public.a45_browser_owns(item_kind,item_id) then raise exception 'This item belongs to another browser'; end if;
 else
  if (item_kind='category' and exists(select 1 from public.categories where id=item_id)) or
     (item_kind='project' and exists(select 1 from public.projects where id::text=item_id)) then raise exception 'Existing materials cannot be replaced through creation'; end if;
  insert into private.a45_browser_items values(item_kind,item_id,md5(k));
 end if;
end;
$$;
revoke all on function private.a45_claim_browser_item(text,text) from public,anon,authenticated;
create or replace function public.a45_open_create_category(doc jsonb) returns public.categories language plpgsql security definer set search_path='' as $$
declare old_uid text:=coalesce(current_setting('request.jwt.claim.sub',true),''); result public.categories; admin_id text;
begin
 select * into result from public.categories where id=doc->>'id';
 if found and not public.a45_browser_owns('category',result.id) then
  if result.parent_id is distinct from nullif(doc->>'parentId','') or not result.is_published then raise exception 'Section conflict'; end if;
  return result; -- Existing ancestors are only read, never changed.
 end if;
 perform private.a45_claim_browser_item('category',doc->>'id');
 select user_id::text into admin_id from private.site_admin limit 1;
 if admin_id is null then raise exception 'Site storage is not configured'; end if;
 perform set_config('request.jwt.claim.sub',admin_id,true);
 result:=public.create_a45_category(doc);
 perform set_config('request.jwt.claim.sub',old_uid,true);
 return result;
end;
$$;
create or replace function public.a45_open_publish_category(category_id text) returns public.categories language plpgsql security definer set search_path='' as $$
declare old_uid text:=coalesce(current_setting('request.jwt.claim.sub',true),''); result public.categories; admin_id text;
begin
 if not public.a45_browser_owns('category',category_id) then raise exception 'This section belongs to another browser'; end if;
 select user_id::text into admin_id from private.site_admin limit 1;
 perform set_config('request.jwt.claim.sub',admin_id,true);
 result:=public.publish_a45_category(category_id);
 perform set_config('request.jwt.claim.sub',old_uid,true);
 return result;
end;
$$;
create or replace function public.a45_open_save_project(doc jsonb,expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_uid text:=coalesce(current_setting('request.jwt.claim.sub',true),''); result jsonb; admin_id text;
begin
 perform private.a45_claim_browser_item('project',doc->>'id');
 -- Do not allow cross-project media IDs to be reassigned by the snapshot RPC.
 if exists(select 1 from jsonb_array_elements(doc->'media') m join public.project_media pm on pm.id=(m->>'id')::uuid where pm.project_id<>(doc->>'id')::uuid) then raise exception 'Media belongs to another project'; end if;
 select user_id::text into admin_id from private.site_admin limit 1;
 if admin_id is null then raise exception 'Site storage is not configured'; end if;
 perform set_config('request.jwt.claim.sub',admin_id,true);
 result:=public.save_a45_project(doc,expected_revision);
 perform set_config('request.jwt.claim.sub',old_uid,true);
 return result;
end;
$$;
revoke all on function public.a45_open_create_category(jsonb),public.a45_open_publish_category(text),public.a45_open_save_project(jsonb,integer) from public;
grant execute on function public.a45_open_create_category(jsonb),public.a45_open_publish_category(text),public.a45_open_save_project(jsonb,integer) to anon,authenticated;
-- Owners can read their pending sections and projects during uploads/retries.
drop policy if exists a45_browser_categories_read on public.categories;
create policy a45_browser_categories_read on public.categories for select to anon,authenticated using(public.a45_browser_owns('category',id));
drop policy if exists a45_browser_projects_read on public.projects;
create policy a45_browser_projects_read on public.projects for select to anon,authenticated using(public.a45_browser_owns('project',id::text));
drop policy if exists a45_browser_project_categories_read on public.project_categories;
create policy a45_browser_project_categories_read on public.project_categories for select to anon,authenticated using(public.a45_browser_owns('project',project_id::text));
drop policy if exists a45_browser_project_tabs_read on public.project_tabs;
create policy a45_browser_project_tabs_read on public.project_tabs for select to anon,authenticated using(public.a45_browser_owns('project',project_id::text));
drop policy if exists a45_browser_project_blocks_read on public.project_blocks;
create policy a45_browser_project_blocks_read on public.project_blocks for select to anon,authenticated using(public.a45_browser_owns('project',project_id::text));
drop policy if exists a45_browser_project_media_read on public.project_media;
create policy a45_browser_project_media_read on public.project_media for select to anon,authenticated using(public.a45_browser_owns('project',project_id::text));
create or replace function public.a45_browser_cover(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select public.a45_browser_owns('category',split_part(object_name,'/',1)) and public.valid_category_cover_path(object_name)
 and exists(select 1 from public.categories where id=split_part(object_name,'/',1) and cover_image_path=object_name);
$$;
create or replace function public.a45_browser_media(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.project_media m where public.a45_browser_owns('project',m.project_id::text) and (m.path=object_name or m.variants->>'thumbnail'=object_name or m.variants->>'content'=object_name or m.variants->>'large'=object_name));
$$;
revoke all on function public.a45_browser_cover(text),public.a45_browser_media(text) from public;
grant execute on function public.a45_browser_cover(text),public.a45_browser_media(text) to anon,authenticated;
drop policy if exists a45_browser_storage_insert on storage.objects;
create policy a45_browser_storage_insert on storage.objects for insert to anon,authenticated with check((bucket_id='category-covers' and public.a45_browser_cover(name)) or (bucket_id='project-media' and public.a45_browser_media(name)));
drop policy if exists a45_browser_storage_select on storage.objects;
create policy a45_browser_storage_select on storage.objects for select to anon,authenticated using((bucket_id='category-covers' and public.a45_browser_cover(name)) or (bucket_id='project-media' and public.a45_browser_media(name)));
alter policy covers_guard_insert on storage.objects with check(bucket_id<>'category-covers' or (public.is_a45_admin() and public.valid_category_cover_path(name)) or public.a45_browser_cover(name));
alter policy covers_guard_select on storage.objects using(bucket_id<>'category-covers' or public.is_a45_admin() or public.a45_browser_cover(name));
alter policy project_media_insert_guard on storage.objects with check(bucket_id<>'project-media' or public.a45_media_access(name,true) or public.a45_browser_media(name));
alter policy project_media_read_guard on storage.objects using(bucket_id<>'project-media' or public.a45_media_access(name,false) or public.a45_browser_media(name));
commit;
