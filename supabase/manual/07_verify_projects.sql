-- READ ONLY. After separately approved manual migration 003.
select version,applied_at from private.a45_schema_migrations where version='003_projects';
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in ('projects','project_categories','project_tabs','project_blocks','project_media');
select tablename,policyname,roles,cmd from pg_policies
 where (schemaname='public' and tablename in ('projects','project_categories','project_tabs','project_blocks','project_media'))
 or (schemaname='storage' and policyname like 'project_media_%') order by tablename,policyname;
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='project-media';
select has_function_privilege('anon','public.save_a45_project(jsonb,integer)','EXECUTE') as anon_can_save,
 has_function_privilege('authenticated','public.save_a45_project(jsonb,integer)','EXECUTE') as authenticated_can_call_admin_gated_save;
select count(*) as categories,count(*) filter(where parent_id is null) as root_categories from public.categories;
-- Expect private bucket, 20 MiB, RLS on 5 tables, anon_can_save=false, categories=45, roots=7.
