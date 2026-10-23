import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id bigint generated always as identity primary key,bucket_id text,name text);
alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to anon,authenticated;grant usage on sequence storage.objects_id_seq to anon,authenticated;
create policy legacy_all on storage.objects for all to anon,authenticated using(true) with check(true);`);
for(const f of ['001_categories.sql','002_seed_categories.sql','003_projects.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
const migration=await readFile(new URL('../supabase/migrations/007_create_categories.sql',import.meta.url),'utf8');
await db.exec(migration);
const admin='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
await db.query('insert into auth.users values($1),($2)',[admin,other]);await db.query('insert into private.site_admin(user_id) values($1)',[admin]);
async function as(role,id=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role)}

await db.exec(await readFile(new URL('../supabase/migrations/008_navigation_catalog.sql',import.meta.url),'utf8'));
const read=async()=>(await db.query('select public.get_a45_navigation() as nav')).rows[0].nav;
const entries=[{id:'photography',parentId:null},{id:'macro',parentId:'photography'},{id:'technical',parentId:null}];
const save=(data=entries,revision=0)=>db.query('select public.save_a45_navigation($1::jsonb,$2) as nav',[JSON.stringify(data),revision]);
await as('anon');assert.equal((await read()).entries,null);await assert.rejects(save());
await as('authenticated',other);await assert.rejects(save());await assert.rejects(db.query('select * from private.a45_navigation'));
await as('authenticated',admin);await save();assert.equal((await read()).revision,1);await assert.rejects(save(),/another session/);await assert.rejects(save([{id:'macro',parentId:'photography'}],1),/parent is missing/);await assert.rejects(save([...entries,entries[0]],1),/Duplicate/);
await save(entries.filter(c=>c.id!=='macro'),1);assert((await db.query("select id from public.categories where id='macro'")).rows.length,'removal never deletes original categories');
await as('anon');assert.deepEqual((await read()).entries,entries.filter(c=>c.id!=='macro'));
await db.exec('reset role');await db.exec(await readFile(new URL('../supabase/migrations/008_navigation_catalog.sql',import.meta.url),'utf8'));assert.equal((await read()).revision,2);
await db.close();console.log('PASS: catalog admin/RLS checks, public current structure, optimistic conflicts, safe removal and repeat migration.');
