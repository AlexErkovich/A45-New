-- Read-only verification after the manually approved setup.
select version, applied_at from private.a45_schema_migrations;
select count(*) as categories,
       count(*) filter (where parent_id is null) as root_categories
from public.categories;
with recursive tree as (
 select id,parent_id,1 as depth from public.categories where parent_id is null
 union all
 select c.id,c.parent_id,t.depth+1 from public.categories c join tree t on c.parent_id=t.id
)
select count(*) as reachable_categories,max(depth) as maximum_depth from tree;
select c.relname, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='public' and c.relname='categories')
   or (n.nspname='private' and c.relname in ('site_admin','a45_schema_migrations'));
select policyname,permissive,roles,cmd from pg_policies
where (schemaname='public' and tablename='categories')
   or (schemaname='storage' and tablename='objects' and policyname like 'covers_%')
order by tablename,policyname;
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='category-covers';
select count(*) as administrators from private.site_admin;
