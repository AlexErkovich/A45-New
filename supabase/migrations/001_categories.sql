begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Only a trusted SQL operator can assign the single administrator.
create table private.site_admin (
 singleton boolean primary key default true check (singleton),
 user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table private.site_admin enable row level security;
revoke all on private.site_admin from public, anon, authenticated;

create function public.is_a45_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (select 1 from private.site_admin where user_id = (select auth.uid()));
$$;
revoke all on function public.is_a45_admin() from public;
grant execute on function public.is_a45_admin() to anon, authenticated;

create table public.categories (
 id text primary key check (id ~ '^[a-z0-9][a-z0-9-]*$'),
 parent_id text references public.categories(id) on delete restrict deferrable initially deferred,
 slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
 title text not null check (length(trim(title)) between 1 and 160),
 description text not null default '' check (length(description) <= 4000),
 cover_image_path text,
 sort_order integer not null default 0,
 is_published boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (parent_id is distinct from id),
 check (cover_image_path is null or
   (cover_image_path ~ '^[a-z0-9-]+/[0-9a-f-]{36}\.(jpg|png|webp)$'
    and split_part(cover_image_path, '/', 1) = id))
);
create index categories_parent_order on public.categories(parent_id, sort_order);

-- Structural edits are serialized; the public API cannot edit parent_id or insert rows.
create function private.lock_category_structure() returns trigger
language plpgsql set search_path = '' as $$
begin
 lock table public.categories in share row exclusive mode;
 return null;
end;
$$;
create trigger categories_structure_lock before insert or update of parent_id on public.categories
for each statement execute function private.lock_category_structure();

create function private.reject_category_cycle() returns trigger
language plpgsql set search_path = '' as $$
begin
 if exists (
  with recursive ancestors as (
   select c.id, c.parent_id from public.categories c where c.id =
     (select parent_id from public.categories where id = new.id)
   union
   select c.id, c.parent_id from public.categories c join ancestors a on c.id = a.parent_id
  ) select 1 from ancestors where id = new.id
 ) then raise exception 'Category cycle is forbidden' using errcode = '23514'; end if;
 return null;
end;
$$;
create constraint trigger categories_no_cycles after insert or update on public.categories
 deferrable initially deferred for each row execute function private.reject_category_cycle();

create function private.touch_category() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end;
$$;
create trigger categories_updated_at before update on public.categories
for each row execute function private.touch_category();

create function public.category_is_published(category_id text) returns boolean
language sql stable security definer set search_path = '' as $$
 with recursive ancestors as (
  select c.id, c.parent_id, c.is_published from public.categories c where c.id = category_id
  union
  select c.id, c.parent_id, c.is_published from public.categories c join ancestors a on c.id = a.parent_id
 ) select coalesce(bool_and(is_published), false) from ancestors;
$$;
revoke all on function public.category_is_published(text) from public;
grant execute on function public.category_is_published(text) to anon, authenticated;

alter table public.categories enable row level security;
revoke all on public.categories from public, anon, authenticated;
grant select on public.categories to anon, authenticated;
grant update (title, description, cover_image_path) on public.categories to authenticated;
create policy categories_public_read on public.categories for select to anon, authenticated
 using (public.category_is_published(id));
create policy categories_admin_read on public.categories for select to authenticated
 using (public.is_a45_admin());
create policy categories_admin_update on public.categories for update to authenticated
 using (public.is_a45_admin()) with check (public.is_a45_admin());

-- Public URLs can read covers. Listing/mutations remain admin-only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
 values ('category-covers', 'category-covers', true, 5242880,
 array['image/jpeg', 'image/png', 'image/webp']);
create function public.valid_category_cover_path(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
 select object_name ~ '^[a-z0-9-]+/[0-9a-f-]{36}\.(jpg|png|webp)$'
 and exists (select 1 from public.categories where id = split_part(object_name, '/', 1));
$$;
revoke all on function public.valid_category_cover_path(text) from public;
grant execute on function public.valid_category_cover_path(text) to authenticated;
create policy covers_admin_select on storage.objects for select to authenticated
 using (bucket_id = 'category-covers' and public.is_a45_admin());
create policy covers_admin_insert on storage.objects for insert to authenticated
 with check (bucket_id = 'category-covers' and public.is_a45_admin() and public.valid_category_cover_path(name));
create policy covers_admin_update on storage.objects for update to authenticated
 using (bucket_id = 'category-covers' and public.is_a45_admin())
 with check (bucket_id = 'category-covers' and public.is_a45_admin() and public.valid_category_cover_path(name));
create policy covers_admin_delete on storage.objects for delete to authenticated
 using (bucket_id = 'category-covers' and public.is_a45_admin()
 and not exists (select 1 from public.categories where cover_image_path = name));
commit;
