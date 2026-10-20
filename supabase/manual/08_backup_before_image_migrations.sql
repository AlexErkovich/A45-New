-- READ ONLY. Export the single JSON result before applying 004 and 005.
select jsonb_build_object(
 'captured_at',now(),
 'project_ref','slajmofddtelskhpjlpa',
 'migrations',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from private.a45_schema_migrations t),
 'categories',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.categories t),
 'projects',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.projects t),
 'project_media',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.project_media t),
 'project_tabs',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.project_tabs t),
 'project_blocks',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.project_blocks t),
 'project_categories',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.project_categories t),
 'bucket',(select to_jsonb(t) from storage.buckets t where id='project-media'),
 'storage_objects',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from storage.objects t where bucket_id='project-media'),
 'policies',(select jsonb_agg(to_jsonb(t)) from pg_policies t where schemaname in ('public','storage')),
 'functions',(select jsonb_agg(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('save_a45_project','a45_media_access','a45_media_readable'))
) as a45_backup;
