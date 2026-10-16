import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
// A disposable PostgreSQL instance: mock only the Supabase-provided schemas/roles.
await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
 grant usage on schema auth, storage to anon, authenticated;
 grant execute on function auth.uid() to anon, authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id bigint generated always as identity primary key,bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to anon,authenticated;
 grant usage on sequence storage.objects_id_seq to anon,authenticated;`);
for(const file of ['001_categories.sql','002_seed_categories.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
const json=await readFile(new URL('../data/projects.js',import.meta.url),'utf8');const local=JSON.parse(json.replace('window.archiveData = ','').trim().replace(/;$/,''));
const {rows}=await db.query('select * from public.categories');assert.equal(rows.length,local.categories.length);
for(const c of local.categories){const row=rows.find(r=>r.id===c.id);assert.equal(row.parent_id,c.parentId);assert.equal(row.slug,c.slug)}
async function denied(sql,params=[]){await assert.rejects(db.query(sql,params));await db.exec('rollback')}
await denied("update public.categories set parent_id='beetles' where id='photography'");
await denied("insert into public.categories(id,parent_id,slug,title) values('self','self','self','self')");
// Deferred checking rejects multi-row and multi-step cycles at commit.
await db.exec("begin; insert into public.categories(id,parent_id,slug,title) values('cycle-a','cycle-b','cycle-a','A'),('cycle-b','cycle-a','cycle-b','B')");await denied('commit');
assert.equal((await db.query("select count(*)::int as n from public.categories where id like 'cycle-%'")).rows[0].n,0);
const admin='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
await db.query('insert into auth.users values($1),($2)',[admin,other]);await db.query('insert into private.site_admin(user_id) values($1)',[admin]);await denied('insert into private.site_admin(user_id) values($1)',[other]);
async function as(role,id=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role)}
await db.exec("update public.categories set is_published=false where id='wildlife'");
await as('anon');assert.equal((await db.query("select * from public.categories where id in ('wildlife','insects','beetles')")).rows.length,0);
assert.equal((await db.query('select public.is_a45_admin() as yes')).rows[0].yes,false);
await denied("update public.categories set title='Hacked' where id='photography'");
await denied("insert into storage.objects(bucket_id,name) values('category-covers','photography/00000000-0000-4000-8000-000000000003.webp')");
await as('authenticated',other);assert.equal((await db.query("update public.categories set title='Hacked' where id='photography' returning id")).rows.length,0);
await denied("insert into storage.objects(bucket_id,name) values('category-covers','photography/00000000-0000-4000-8000-000000000003.webp')");
await denied('insert into private.site_admin(user_id) values($1)',[other]);
await as('authenticated',admin);assert.equal((await db.query('select public.is_a45_admin() as yes')).rows[0].yes,true);
assert.equal((await db.query("select id from public.categories where id='beetles'")).rows.length,1);
await denied("update public.categories set parent_id=null where id='beetles'");await denied("update public.categories set is_published=true where id='beetles'");
await denied("insert into public.categories(id,slug,title) values('new','new','New')");
await db.exec("update public.categories set title='Фото' where id='photography'");
const path='photography/00000000-0000-4000-8000-000000000003.webp';
await db.query("insert into storage.objects(bucket_id,name) values('category-covers',$1)",[path]);
await db.query("update public.categories set cover_image_path=$1 where id='photography'",[path]);
assert.equal((await db.query('delete from storage.objects where name=$1 returning id',[path])).rows.length,0,'referenced image protected');
await db.exec("update public.categories set cover_image_path=null where id='photography'");assert.equal((await db.query('delete from storage.objects where name=$1 returning id',[path])).rows.length,1);
await denied("insert into storage.objects(bucket_id,name) values('category-covers','photography/file.svg')");
await denied("insert into storage.objects(bucket_id,name) values('other','photography/00000000-0000-4000-8000-000000000003.webp')");
await db.exec('reset role');
const bucket=(await db.query("select * from storage.buckets where id='category-covers'")).rows[0];assert(bucket.public);assert.equal(Number(bucket.file_size_limit),5242880);assert.deepEqual(bucket.allowed_mime_types,['image/jpeg','image/png','image/webp']);
await db.close();console.log('PASS: real PostgreSQL migrations, 45 preserved category IDs/parents, cycles, public/draft reads, singleton admin, denied anon/non-admin writes/uploads, protected tree columns and referenced images.');
