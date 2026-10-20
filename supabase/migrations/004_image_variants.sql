-- MANUAL ONLY. Back up, review and test with Supabase CLI before production.
begin;
select pg_advisory_xact_lock(1045,4);
do $migration$
begin
 if exists(select 1 from private.a45_schema_migrations where version='004_image_variants') then return; end if;
 alter table public.project_media add column variants jsonb not null default '{}',
 add column width integer check(width>0),add column height integer check(height>0),
 add column alt text not null default '' check(length(alt)<=2000),
 add column caption text not null default '' check(length(caption)<=4000);
 alter table public.project_media drop constraint project_media_size_check;
 alter table public.project_media add constraint project_media_size_check check(size between 1 and case when kind='image' then 31457280 else 20971520 end);
 alter table public.project_media add constraint project_media_variants_check check(
 jsonb_typeof(variants)='object' and (variants='{}'::jsonb or (
 kind='image' and width is not null and height is not null and
 variants=jsonb_build_object('thumbnail',path||'/thumbnail.webp','content',path||'/content.webp','large',path||'/large.webp'))));
 update storage.buckets set file_size_limit=31457280 where id='project-media';
 create or replace function public.save_a45_project(doc jsonb,expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $fn$
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
   insert into public.project_media(id,project_id,path,name,mime_type,size,kind,variants,width,height,alt,caption)
   values((m->>'id')::uuid,pid,pid::text||'/'||(m->>'id'),m->>'name',m->>'mimeType',(m->>'size')::bigint,m->>'kind',coalesce(m->'variants','{}'),(m->>'width')::integer,(m->>'height')::integer,coalesce(m->>'alt',''),coalesce(m->>'caption',''))
   on conflict(id) do update set alt=excluded.alt,caption=excluded.caption,
    variants=case when public.project_media.variants='{}'::jsonb then excluded.variants else public.project_media.variants end,
    width=coalesce(public.project_media.width,excluded.width),height=coalesce(public.project_media.height,excluded.height) where public.project_media.project_id=pid;
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


 create or replace function public.a45_media_readable(target uuid) returns boolean language sql stable security definer set search_path='' as $fn$
 select public.is_a45_admin() or exists(select 1 from public.project_media m join public.projects p on p.id=m.project_id
 where m.id=target and p.status='published' and (p.cover_media_id=m.id or
 (p.cover_original_id=m.id and m.variants<>'{}'::jsonb) or exists(
 select 1 from public.project_blocks b where b.project_id=p.id and jsonb_path_exists(b.content,'$.**.mediaId ? (@ == $id)',jsonb_build_object('id',target::text)))))
 $fn$;
 create or replace function public.a45_media_access(object_name text,writing boolean default false) returns boolean language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from public.project_media m where
 (m.path=object_name or m.variants->>'thumbnail'=object_name or m.variants->>'content'=object_name or m.variants->>'large'=object_name)
 and case when writing then public.is_a45_admin() else
 public.is_a45_admin() or (public.a45_media_readable(m.id) and
 ((m.variants='{}'::jsonb and m.kind<>'original') or (m.path<>object_name and m.variants<>'{}'::jsonb))) end)
 $fn$;
 insert into private.a45_schema_migrations(version) values('004_image_variants');
end $migration$;
commit;
