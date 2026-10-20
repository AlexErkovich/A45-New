import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
// A disposable PostgreSQL instance: mock only the Supabase-provided schemas/roles.
const bootstrap=`create role anon; create role authenticated; create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
 grant usage on schema auth, storage to anon, authenticated;
 grant execute on function auth.uid() to anon, authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id bigint generated always as identity primary key,bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to anon,authenticated;
 grant usage on sequence storage.objects_id_seq to anon,authenticated;`;
await db.exec(bootstrap);
// Simulate broad pre-existing Storage policies; A45 guards must still deny writes.
await db.exec(`create policy legacy_storage_access on storage.objects for all to anon, authenticated using (true) with check (true);
 insert into storage.buckets(id,name,public) values ('unrelated','unrelated',false);
 insert into storage.objects(bucket_id,name) values ('unrelated','keep.txt');`);
for(const file of ['001_categories.sql','002_seed_categories.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
const json=await readFile(new URL('../data/projects.js',import.meta.url),'utf8');const local=JSON.parse(json.replace('window.archiveData = ','').trim().replace(/;$/,''));
const {rows}=await db.query('select * from public.categories');assert.equal(rows.length,local.categories.length);
for(const c of local.categories){const row=rows.find(r=>r.id===c.id);assert.equal(row.parent_id,c.parentId);assert.equal(row.slug,c.slug);assert.equal(row.title,c.title);assert.equal(row.description,c.description);assert.equal(row.sort_order,c.sortOrder)}
async function denied(sql,params=[]){await assert.rejects(db.query(sql,params));await db.exec('rollback')}
await denied("update public.categories set parent_id='beetles' where id='photography'");
await denied("insert into public.categories(id,parent_id,slug,title) values('self','self','self','self')");
await db.exec(`begin;insert into public.categories(id,parent_id,slug,title)
 select 'deep-'||i,case when i=1 then 'beetles' else 'deep-'||(i-1) end,'deep-'||i,'Level '||i from generate_series(1,25) i;`);
assert.equal((await db.query(`with recursive t as (select id,parent_id,1 as d from public.categories where parent_id is null union all select c.id,c.parent_id,t.d+1 from public.categories c join t on c.parent_id=t.id) select max(d)::int as n from t`)).rows[0].n,30);
await db.exec("update public.categories set parent_id='deep-25' where id='photography'");await denied('commit');

// Deferred checking rejects multi-row and multi-step cycles at commit.
await db.exec("begin; insert into public.categories(id,parent_id,slug,title) values('cycle-a','cycle-b','cycle-a','A'),('cycle-b','cycle-a','cycle-b','B')");await denied('commit');
assert.equal((await db.query("select count(*)::int as n from public.categories where id like 'cycle-%'")).rows[0].n,0);
const admin='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
await db.query('insert into auth.users(id) values($1),($2)',[admin,other]);await db.query('insert into private.site_admin(user_id) values($1)',[admin]);await denied('insert into private.site_admin(user_id) values($1)',[other]);
const assignSource=await readFile(new URL('../supabase/manual/03_assign_admin.sql',import.meta.url),'utf8');
// The user may have filled the real UUID in the manual script; fixtures must stay isolated.
const assignSql=assignSource.replace(/target\s+uuid\s*:=\s*'[^']+'\s*::uuid\s*;/,"target uuid := '<ADMIN_USER_UUID>'::uuid;");
assert(assignSql.includes("target uuid := '<ADMIN_USER_UUID>'::uuid;"));
await db.exec(assignSql.replace('<ADMIN_USER_UUID>',admin));await db.exec(assignSql.replace('<ADMIN_USER_UUID>',admin));
await assert.rejects(db.exec(assignSql.replace('<ADMIN_USER_UUID>',other)));await db.exec('rollback');
assert.equal((await db.query('select user_id from private.site_admin')).rows[0].user_id,admin);
await db.exec(await readFile(new URL('../supabase/manual/00_preflight.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/manual/04_verify.sql',import.meta.url),'utf8'));
const diagnostics=(await db.query(await readFile(new URL('../supabase/manual/05_diagnostics.sql',import.meta.url),'utf8'))).rows[0].a45_diagnostics;assert.equal(diagnostics.categories,45);assert.equal(diagnostics.administrators,1);assert.equal(diagnostics.category_privileges.anon_update_title,false);assert.equal(diagnostics.bucket.file_size_limit,5242880);
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
await db.exec("insert into storage.objects(bucket_id,name) values('unrelated','another.txt')"); // Existing unrelated bucket policy is unchanged.
await db.exec('reset role');
const bucket=(await db.query("select * from storage.buckets where id='category-covers'")).rows[0];assert(bucket.public);assert.equal(Number(bucket.file_size_limit),5242880);assert.deepEqual(bucket.allowed_mime_types,['image/jpeg','image/png','image/webp']);
// Re-runs preserve edited content, images, the administrator, IDs, and unrelated data.
await db.exec("update public.categories set cover_image_path='photography/00000000-0000-4000-8000-000000000009.webp' where id='photography'");
const before=(await db.query('select * from public.categories order by id')).rows;
const beforeAdmin=(await db.query('select * from private.site_admin')).rows;
for(let i=0;i<2;i++)for(const f of ['001_categories.sql','002_seed_categories.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
assert.deepEqual((await db.query('select * from public.categories order by id')).rows,before);
assert.deepEqual((await db.query('select * from private.site_admin')).rows,beforeAdmin);
assert.equal((await db.query('select count(*)::int as n from private.a45_schema_migrations')).rows[0].n,1);
assert.equal((await db.query("select name from storage.objects where bucket_id='unrelated'")).rows[0].name,'keep.txt');
await as('anon');await denied("insert into storage.objects(bucket_id,name) values('category-covers','photography/00000000-0000-4000-8000-000000000003.webp')");
await db.exec('reset role');
console.log('PASS: 30-level hierarchy and deep cycle rejection; manual SQL syntax and repeat-safe admin assignment.');
console.log('PASS: repeated migrations preserve every row/timestamp/admin/cover, unrelated Storage data retained, broad legacy Storage policy cannot bypass A45 guards.');
// Unknown pre-existing categories must trigger an atomic stop, not adoption or replacement.
const conflictDb=new PGlite();await conflictDb.exec(bootstrap);
await conflictDb.exec("create table public.categories(id text primary key,title text);insert into public.categories values('existing','Keep me')");
await assert.rejects(conflictDb.exec(await readFile(new URL('../supabase/migrations/001_categories.sql',import.meta.url),'utf8')));
await conflictDb.exec('rollback');assert.equal((await conflictDb.query('select title from public.categories')).rows[0].title,'Keep me');
assert.equal((await conflictDb.query("select to_regclass('private.site_admin') as t")).rows[0].t,null);await conflictDb.close();
console.log('PASS: conflicting existing schema is left intact, and the failed migration rolls back atomically.');
await db.close();console.log('PASS: real PostgreSQL migrations, 45 preserved category IDs/parents, cycles, public/draft reads, singleton admin, denied anon/non-admin writes/uploads, protected tree columns and referenced images.');
