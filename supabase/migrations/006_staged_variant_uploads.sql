-- MANUAL ONLY. Compatibility for images staged before migration 004.
-- Allows only administrators to upload reserved derivatives; public reads still require registered variants.
begin;
select pg_advisory_xact_lock(1045,6);
do $migration$
begin
 if exists(select 1 from private.a45_schema_migrations where version='006_staged_variant_uploads') then return; end if;
 if not exists(select 1 from private.a45_schema_migrations where version='004_image_variants') then raise exception 'Apply 004_image_variants first'; end if;
 create or replace function public.a45_media_access(object_name text,writing boolean default false) returns boolean language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from public.project_media m where
 case when writing then public.is_a45_admin() and
 (m.path=object_name or m.variants->>'thumbnail'=object_name or m.variants->>'content'=object_name or m.variants->>'large'=object_name or
 (m.kind='image' and object_name in (m.path||'/thumbnail.webp',m.path||'/content.webp',m.path||'/large.webp')))
 else
 (m.path=object_name or m.variants->>'thumbnail'=object_name or m.variants->>'content'=object_name or m.variants->>'large'=object_name) and
 (public.is_a45_admin() or (public.a45_media_readable(m.id) and
 ((m.variants='{}'::jsonb and m.kind<>'original') or (m.path<>object_name and m.variants<>'{}'::jsonb)))) end)
 $fn$;
 insert into private.a45_schema_migrations(version) values('006_staged_variant_uploads');
end $migration$;
commit;
