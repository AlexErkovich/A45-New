-- Run ONLY after creating and confirming the user in Authentication > Users.
-- Replace the UUID placeholder below with that user's real UUID. Never paste a password here.
begin;
lock table private.site_admin in share row exclusive mode;
do $a45_admin$
declare
 target uuid := '1881c11e-6e5e-4dfc-9be8-cb610938ce25'::uuid;
begin
 if not exists (select 1 from auth.users where id=target and email_confirmed_at is not null) then
  raise exception 'Create and confirm this Auth user first.';
 end if;
 if exists (select 1 from private.site_admin where user_id <> target) then
  raise exception 'A different administrator already exists. No changes made.';
 end if;
 insert into private.site_admin(singleton,user_id) values(true,target)
 on conflict(singleton) do nothing;
end;
$a45_admin$;
commit;
-- This privileged query is for SQL Editor only, not the frontend.
select a.user_id, u.email from private.site_admin a join auth.users u on u.id=a.user_id;
