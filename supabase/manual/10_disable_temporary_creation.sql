-- Stop all browser-owned writes and pending reads without deleting created content.
begin;
update private.a45_creation_mode set enabled=false;
revoke execute on function public.a45_open_create_category(jsonb),public.a45_open_publish_category(text),public.a45_open_save_project(jsonb,integer) from anon,authenticated;
commit;
