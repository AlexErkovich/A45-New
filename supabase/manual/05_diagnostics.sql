-- Read-only: run as postgres. One result cell, no passwords, tokens or admin email.
with recursive tree as (
 select id,parent_id,1 as depth,array[id] as path from public.categories where parent_id is null
 union all
 select c.id,c.parent_id,t.depth+1,t.path||c.id
 from public.categories c join tree t on c.parent_id=t.id where not c.id=any(t.path)
)
select jsonb_build_object(
 'categories', (select count(*) from public.categories),
 'roots', (select count(*) from public.categories where parent_id is null),
 'reachable', (select count(*) from tree),
 'maximum_depth', (select max(depth) from tree),
 'administrators', (select count(*) from private.site_admin),
 'migrations', (select jsonb_agg(version) from private.a45_schema_migrations),
 'rls', (select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'enabled',c.relrowsecurity))
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where (n.nspname='public' and c.relname='categories')
      or (n.nspname='private' and c.relname in ('site_admin','a45_schema_migrations'))
      or (n.nspname='storage' and c.relname='objects')),
 'bucket', (select jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types)
   from storage.buckets where id='category-covers'),
 'category_privileges', jsonb_build_object(
   'anon_select',has_table_privilege('anon','public.categories','SELECT'),
   'anon_update_title',has_column_privilege('anon','public.categories','title','UPDATE'),
   'authenticated_update_title',has_column_privilege('authenticated','public.categories','title','UPDATE'),
   'authenticated_update_parent',has_column_privilege('authenticated','public.categories','parent_id','UPDATE')),
 'policies', (select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',policyname,
   'permissive',permissive,'roles',roles,'command',cmd,'using',qual,'with_check',with_check))
   from pg_policies where (schemaname='public' and tablename='categories')
      or (schemaname='storage' and tablename='objects'))
) as a45_diagnostics;
