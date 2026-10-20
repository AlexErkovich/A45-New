-- MANUAL ONLY. Validate locally; back up and review before executing in production.
begin;
select pg_advisory_xact_lock(1045, 3);
do $migration$
begin
 if exists(select 1 from private.a45_schema_migrations where version='003_projects') then return; end if;
 if to_regclass('public.projects') is not null or to_regclass('public.project_media') is not null
 or to_regclass('public.project_categories') is not null or to_regclass('public.project_tabs') is not null
 or to_regclass('public.project_blocks') is not null
 or exists(select 1 from storage.buckets where id='project-media') then
  raise exception 'Existing project schema/bucket: inspect manually; nothing was changed';
 end if;
 create table public.projects(
  id uuid primary key,
  slug text not null unique check(slug ~ '^p-[a-f0-9-]{36}$'),
  title text not null check(length(trim(title)) between 1 and 200),
  description text not null default '' check(length(description)<=4000),
  year integer check(year between 1 and 9999),
  primary_category_id text not null references public.categories(id) on delete restrict,
  status text not null default 'draft' check(status in ('draft','published')),
  cover_media_id uuid,
  cover_original_id uuid,
  cover_crop jsonb not null default '{"zoom":1,"x":0.5,"y":0.5}',
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
 );
 create table public.project_categories(
  id uuid primary key,project_id uuid not null references public.projects(id) on delete cascade,
  category_id text not null references public.categories(id) on delete restrict,
  unique(project_id,category_id)
 );
 create table public.project_tabs(
  id uuid primary key,project_id uuid not null references public.projects(id) on delete cascade,
  key text not null check(key ~ '^[a-z0-9-]+$'),title text not null check(length(trim(title)) between 1 and 160),
  sort_order integer not null check(sort_order>=0),unique(project_id,key),unique(project_id,id)
 );
 create table public.project_blocks(
  id uuid primary key,project_id uuid not null references public.projects(id) on delete cascade,
  tab_id uuid not null, type text not null check(type in ('TEXT','HEADING','IMAGE','GALLERY','VIDEO','FILE','LIST')),
  sort_order integer not null check(sort_order>=0),content jsonb not null default '{}',
  foreign key(project_id,tab_id) references public.project_tabs(project_id,id) on delete cascade,
  check(jsonb_typeof(content)='object')
 );
 create table public.project_media(
  id uuid primary key,project_id uuid not null references public.projects(id) on delete cascade,
  path text not null unique, name text not null check(length(name) between 1 and 255),
  mime_type text not null,size bigint not null check(size between 1 and 20971520),
  kind text not null check(kind in ('image','file','cover','original')),
  created_at timestamptz not null default now(),unique(project_id,id),
  check(path=project_id::text||'/'||id::text),
  check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf','application/zip','application/octet-stream','text/plain'))
 );
 alter table public.projects add constraint cover_same_project foreign key(id,cover_media_id) references public.project_media(project_id,id) deferrable initially deferred;
 alter table public.projects add constraint original_same_project foreign key(id,cover_original_id) references public.project_media(project_id,id) deferrable initially deferred;
 create index project_status_idx on public.projects(status,published_at);
 create index project_category_idx on public.project_categories(category_id,project_id);
 create index project_tabs_order_idx on public.project_tabs(project_id,sort_order);
 create index project_blocks_order_idx on public.project_blocks(tab_id,sort_order);
 create index project_media_project_idx on public.project_media(project_id);
 create function public.a45_project_readable(target uuid) returns boolean language sql stable security definer set search_path='' as $fn$
  select public.is_a45_admin() or exists(select 1 from public.projects where id=target and status='published')
 $fn$;
 revoke all on function public.a45_project_readable(uuid) from public;
 grant execute on function public.a45_project_readable(uuid) to anon,authenticated;
 alter table public.projects enable row level security;
 alter table public.project_categories enable row level security;
 alter table public.project_tabs enable row level security;
 alter table public.project_blocks enable row level security;
 alter table public.project_media enable row level security;
 create policy projects_read on public.projects for select to anon,authenticated using (public.a45_project_readable(id));
 create policy project_categories_read on public.project_categories for select to anon,authenticated using (public.a45_project_readable(project_id));
 create policy project_tabs_read on public.project_tabs for select to anon,authenticated using (public.a45_project_readable(project_id));
 create policy project_blocks_read on public.project_blocks for select to anon,authenticated using (public.a45_project_readable(project_id));
 create function public.a45_media_readable(target uuid) returns boolean language sql stable security definer set search_path='' as $fn$
  select public.is_a45_admin() or exists(select 1 from public.project_media m join public.projects p on p.id=m.project_id
   where m.id=target and p.status='published' and (p.cover_media_id=m.id or exists(
    select 1 from public.project_blocks b where b.project_id=p.id and jsonb_path_exists(b.content,'$.**.mediaId ? (@ == $id)',jsonb_build_object('id',target::text)))))
 $fn$;
 revoke all on function public.a45_media_readable(uuid) from public;
 grant execute on function public.a45_media_readable(uuid) to anon,authenticated;
 create policy project_media_read on public.project_media for select to anon,authenticated using (public.a45_media_readable(id));
 -- All writes go through the atomic, admin-gated snapshot function; direct REST writes have no grants/policies.
 revoke all on public.projects,public.project_categories,public.project_tabs,public.project_blocks,public.project_media from anon,authenticated;
 grant select on public.projects,public.project_categories,public.project_tabs,public.project_blocks,public.project_media to anon,authenticated;
 create function public.save_a45_project(doc jsonb,expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $fn$
 declare pid uuid:=(doc->>'id')::uuid; existing public.projects; t jsonb; b jsonb; m jsonb; cat jsonb; new_revision integer;
 begin
  if not public.is_a45_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(pid::text,1045));
  select * into existing from public.projects where id=pid for update;
  if existing.id is not null and existing.revision<>expected_revision then raise exception 'Project changed in another session; reload before saving' using errcode='40001'; end if;
  if existing.id is null and expected_revision<>0 then raise exception 'Project not found'; end if;
  if jsonb_array_length(doc->'tabs')<1 or doc->'tabs'->0->>'key'<>'overview' then raise exception 'Overview must be first'; end if;
  if not (doc->'categoryIds' ? (doc->>'primaryCategoryId')) then raise exception 'Primary category must be selected'; end if;
  new_revision:=coalesce(existing.revision,0)+1;
  insert into public.projects(id,slug,title,description,year,primary_category_id,status,cover_media_id,cover_original_id,cover_crop,revision,published_at)
  values(pid,'p-'||pid::text,doc->>'title',coalesce(doc->>'description',''),(doc->>'year')::integer,doc->>'primaryCategoryId',doc->>'status',
   nullif(doc->>'coverMediaId','')::uuid,nullif(doc->>'coverOriginalId','')::uuid,coalesce(doc->'coverCrop','{}'),new_revision,
   case when doc->>'status'='published' then coalesce(existing.published_at,now()) end)
  on conflict(id) do update set title=excluded.title,description=excluded.description,year=excluded.year,primary_category_id=excluded.primary_category_id,
   status=excluded.status,cover_media_id=excluded.cover_media_id,cover_original_id=excluded.cover_original_id,cover_crop=excluded.cover_crop,
   revision=excluded.revision,updated_at=now(),published_at=excluded.published_at;
  -- Only associations/tabs/blocks of THIS explicitly saved project are reconciled, atomically.
  delete from public.project_categories where project_id=pid and not (doc->'categoryIds' ? category_id);
  for cat in select value from jsonb_array_elements(doc->'categoryIds') loop
   insert into public.project_categories(id,project_id,category_id) values(gen_random_uuid(),pid,cat#>>'{}') on conflict(project_id,category_id) do nothing;
  end loop;
  for m in select value from jsonb_array_elements(coalesce(doc->'media','[]')) loop
   insert into public.project_media(id,project_id,path,name,mime_type,size,kind)
   values((m->>'id')::uuid,pid,pid::text||'/'||(m->>'id'),m->>'name',m->>'mimeType',(m->>'size')::bigint,m->>'kind')
   on conflict(id) do nothing;
   if not exists(select 1 from public.project_media where id=(m->>'id')::uuid and project_id=pid) then raise exception 'Media belongs to another project'; end if;
  end loop;
  delete from public.project_blocks where project_id=pid;
  delete from public.project_tabs where project_id=pid and id not in (select (value->>'id')::uuid from jsonb_array_elements(doc->'tabs'));
  for t in select value from jsonb_array_elements(doc->'tabs') loop
   insert into public.project_tabs(id,project_id,key,title,sort_order) values((t->>'id')::uuid,pid,t->>'key',t->>'title',(t->>'sortOrder')::integer)
   on conflict(id) do update set title=excluded.title,sort_order=excluded.sort_order where public.project_tabs.project_id=pid;
   if not exists(select 1 from public.project_tabs where id=(t->>'id')::uuid and project_id=pid) then raise exception 'Tab belongs to another project'; end if;
   for b in select value from jsonb_array_elements(coalesce(t->'blocks','[]')) loop
    insert into public.project_blocks(id,project_id,tab_id,type,sort_order,content) values((b->>'id')::uuid,pid,(t->>'id')::uuid,b->>'type',(b->>'sortOrder')::integer,b->'content');
   end loop;
  end loop;
  return jsonb_build_object('id',pid,'slug','p-'||pid::text,'revision',new_revision);
 end $fn$;
 revoke all on function public.save_a45_project(jsonb,integer) from public;
 grant execute on function public.save_a45_project(jsonb,integer) to authenticated;
 insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('project-media','project-media',false,20971520,
  array['image/jpeg','image/png','image/webp','application/pdf','application/zip','application/octet-stream','text/plain']);
 create function public.a45_media_access(object_name text,writing boolean default false) returns boolean language sql stable security definer set search_path='' as $fn$
  select exists(select 1 from public.project_media m where m.path=object_name and
   case when writing then public.is_a45_admin() else public.a45_media_readable(m.id) end)
 $fn$;
 revoke all on function public.a45_media_access(text,boolean) from public;
 grant execute on function public.a45_media_access(text,boolean) to anon,authenticated;
 create policy project_media_download on storage.objects for select to anon,authenticated using(bucket_id='project-media' and public.a45_media_access(name,false));
 create policy project_media_upload on storage.objects for insert to authenticated with check(bucket_id='project-media' and public.a45_media_access(name,true));
 -- Restrictive guards also protect against broad legacy policies on storage.objects.
 create policy project_media_read_guard on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'project-media' or public.a45_media_access(name,false));
 create policy project_media_insert_guard on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'project-media' or public.a45_media_access(name,true));
 create policy project_media_update_guard on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'project-media') with check(bucket_id<>'project-media');
 create policy project_media_delete_guard on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'project-media');
 insert into private.a45_schema_migrations(version) values('003_projects');
end $migration$;
commit;
