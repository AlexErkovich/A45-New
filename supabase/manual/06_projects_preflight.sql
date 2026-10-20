-- READ ONLY. Run and review BEFORE approving migration 003_projects.sql.
select version,applied_at from private.a45_schema_migrations order by version;
select count(*) as categories,count(*) filter(where parent_id is null) as root_categories from public.categories;
select count(*) as administrators from private.site_admin;
select table_name from information_schema.tables where table_schema='public'
 and table_name in ('projects','project_categories','project_tabs','project_blocks','project_media');
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='project-media';
-- On first installation: 45 categories, 7 roots, 1 administrator;
-- no new project tables and no project-media bucket. If they exist, STOP and inspect.
