-- Read-only inspection. Run first as postgres in the project's SQL Editor.
select current_database() as database_name, current_user as sql_role;
select to_regclass('public.categories') as categories,
       to_regclass('private.site_admin') as administrator,
       to_regclass('private.a45_schema_migrations') as migration_history;
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'category-covers';
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies where (schemaname='public' and tablename='categories')
                   or (schemaname='storage' and tablename='objects')
order by schemaname, tablename, policyname;
-- If the A45 tables/bucket already exist without migration history, stop for review.
