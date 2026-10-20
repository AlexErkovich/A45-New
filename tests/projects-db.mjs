import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {newProject,newTab,uid,normalize} from '../src/project-model.mjs';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id bigint generated always as identity primary key,bucket_id text,name text);
alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to anon,authenticated;grant usage on sequence storage.objects_id_seq to anon,authenticated;
create policy legacy_all on storage.objects for all to anon,authenticated using(true) with check(true);`);
for(const f of ['001_categories.sql','002_seed_categories.sql','003_projects.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
const before=(await db.query('select * from public.categories order by id')).rows;
const admin=uid(),other=uid();await db.query('insert into auth.users values($1),($2)',[admin,other]);await db.query('insert into private.site_admin(user_id) values($1)',[admin]);
async function as(role,id=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role)}
async function save(d){const {rows}=await db.query('select public.save_a45_project($1::jsonb,$2) as result',[JSON.stringify(normalize(d)),d.revision]);d.revision=rows[0].result.revision;return rows[0].result}
const d=newProject('technical');d.title='Draft example';d.categoryIds=['technical','video','film-equipment'];d.tabs.push(newTab('Документы'));const image=uid(),file=uid();d.media=[{id:image,name:'test.png',mimeType:'image/png',size:10,kind:'image'},{id:file,name:'test.pdf',mimeType:'application/pdf',size:10,kind:'file'}];d.tabs[0].blocks=[{id:uid(),type:'IMAGE',content:{mediaId:image,caption:'Caption'}}];d.tabs[1].blocks=[{id:uid(),type:'FILE',content:{mediaId:file}}];
await as('anon');await assert.rejects(save(d));await assert.rejects(db.exec("insert into public.projects(id,slug,title,primary_category_id) values(gen_random_uuid(),'bad','Bad','technical')"));
await as('authenticated',other);await assert.rejects(save(d));
await as('authenticated',admin);await save(d);
assert.equal((await db.query('select count(*)::int n from public.project_categories')).rows[0].n,3);
for(const id of [image,file])await db.query("insert into storage.objects(bucket_id,name) values('project-media',$1)",[d.id+'/'+id]);
await as('anon');for(const table of ['projects','project_categories','project_tabs','project_blocks','project_media'])assert.equal((await db.query('select * from public.'+table)).rows.length,0,table+' hides drafts');assert.equal((await db.query("select * from storage.objects where bucket_id='project-media'")).rows.length,0,'direct draft downloads hidden despite legacy policy');
await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('project-media',$1)",[d.id+'/'+uid()]));
await as('authenticated',other);assert.equal((await db.query('select * from public.projects')).rows.length,0);await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('project-media',$1)",[d.id+'/'+image]));
await as('authenticated',admin);d.status='published';await save(d);
await as('anon');assert.equal((await db.query('select * from public.projects')).rows.length,1);assert.equal((await db.query('select * from public.project_tabs')).rows.length,2);assert.equal((await db.query('select * from public.project_media')).rows.length,2);assert.equal((await db.query("select * from storage.objects where bucket_id='project-media'")).rows.length,2);await assert.rejects(db.exec("update public.projects set title='hacked'"));
await as('authenticated',admin);const stale=structuredClone(d);d.title='Changed';d.tabs[1].title='Downloads';await save(d);await assert.rejects(save(stale));assert.equal((await db.query('select title from public.projects')).rows[0].title,'Changed');
const staged=uid();d.media.push({id:staged,name:'unpublished.png',mimeType:'image/png',kind:'image',size:10});await save(d);await db.query("insert into storage.objects(bucket_id,name) values('project-media',$1)",[d.id+'/'+staged]);
await as('anon');assert.equal((await db.query('select * from public.project_media where id=$1',[staged])).rows.length,0,'staged edits under published project remain private');assert.equal((await db.query('select * from storage.objects where name=$1',[d.id+'/'+staged])).rows.length,0);
await as('authenticated',admin);d.status='draft';await save(d);await as('anon');assert.equal((await db.query('select * from public.projects')).rows.length,0);assert.equal((await db.query("select * from storage.objects where bucket_id='project-media'")).rows.length,0,'unpublish immediately revokes new downloads');
await as('authenticated',admin);const invalid=structuredClone(d);invalid.primaryCategoryId='missing';await assert.rejects(save(invalid));assert.equal((await db.query('select revision from public.projects')).rows[0].revision,d.revision);
await db.exec('reset role');const snapshot=(await db.query('select * from public.projects')).rows;await db.exec(await readFile(new URL('../supabase/migrations/003_projects.sql',import.meta.url),'utf8'));assert.deepEqual((await db.query('select * from public.projects')).rows,snapshot);assert.deepEqual((await db.query('select * from public.categories order by id')).rows,before);
assert.equal((await db.query("select public from storage.buckets where id='project-media'")).rows[0].public,false);
await db.exec(await readFile(new URL('../supabase/manual/06_projects_preflight.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('../supabase/manual/07_verify_projects.sql',import.meta.url),'utf8'));

// New variants preserve legacy reads while protecting archive originals, including broad legacy policies.
const migration004=await readFile(new URL('../supabase/migrations/004_image_variants.sql',import.meta.url),'utf8');
await db.exec(migration004);await db.exec(migration004);
await as('authenticated',admin);const photo=uid(),path=d.id+'/'+photo;
d.media.push({id:photo,name:'large.jpg',mimeType:'image/jpeg',kind:'image',size:30*1024*1024,width:4000,height:3000,variants:{thumbnail:path+'/thumbnail.webp',content:path+'/content.webp',large:path+'/large.webp'},alt:'Landscape'});
d.tabs[0].blocks.push({id:uid(),type:'IMAGE',content:{mediaId:photo}});d.status='published';await save(d);
for(const p of [path,path+'/thumbnail.webp',path+'/content.webp',path+'/large.webp'])await db.query("insert into storage.objects(bucket_id,name) values('project-media',$1)",[p]);
// A photo staged with migration 003 can receive its variants once 004 is applied.
const stagedUpgrade=d.media.find(m=>m.id===staged);const stagedPath=d.id+'/'+staged;stagedUpgrade.variants={thumbnail:stagedPath+'/thumbnail.webp',content:stagedPath+'/content.webp',large:stagedPath+'/large.webp'};stagedUpgrade.width=400;stagedUpgrade.height=300;await save(d);assert.equal((await db.query('select variants from public.project_media where id=$1',[staged])).rows[0].variants.content,stagedPath+'/content.webp');
await as('anon');assert.equal((await db.query('select * from public.project_media where id=$1',[photo])).rows.length,1);
assert.equal((await db.query("select * from storage.objects where name=$1",[path])).rows.length,0,'archive original never public');
for(const variant of ['thumbnail','content','large'])assert.equal((await db.query("select * from storage.objects where name=$1",[path+'/'+variant+'.webp'])).rows.length,1);
await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('project-media',$1)",[path+'/large.webp']));
await as('authenticated',other);assert.equal((await db.query("select * from storage.objects where name=$1",[path])).rows.length,0);
await as('authenticated',admin);assert.equal((await db.query("select * from storage.objects where name=$1",[path])).rows.length,1);
const invalidVariants=structuredClone(d);invalidVariants.media.push({...invalidVariants.media.at(-1),id:uid(),variants:{content:'another-project/secret'}});await assert.rejects(save(invalidVariants));
// Cover-only source is readable as optimized content, but its archive remains private.
await as('authenticated',admin);d.tabs[0].blocks=d.tabs[0].blocks.filter(b=>b.content.mediaId!==photo);d.coverOriginalId=photo;d.coverMediaId=image;await save(d);
await as('anon');assert.equal((await db.query('select * from public.project_media where id=$1',[photo])).rows.length,1);assert.equal((await db.query("select * from storage.objects where name=$1",[path])).rows.length,0);
await as('authenticated',admin);d.status='draft';await save(d);await as('anon');assert.equal((await db.query("select * from storage.objects where name like $1",[path+'%'])).rows.length,0);
await db.exec('reset role');assert.deepEqual((await db.query('select * from public.categories order by id')).rows,before);
console.log('PASS: migration 004 repeat-safe, 30 MB, immutable variant paths, public derivatives only, private originals/drafts, outsider writes denied.');

await db.exec('reset role');const migration005=await readFile(new URL('../supabase/migrations/005_project_media_reconcile.sql',import.meta.url),'utf8');await db.exec(migration005);await db.exec(migration005);
await as('authenticated',admin);d.coverMediaId=null;d.coverOriginalId=null;d.media=d.media.filter(m=>m.id!==photo);await save(d);
assert.equal((await db.query('select * from public.project_media where id=$1',[photo])).rows.length,0,'removed photo metadata stays removed after reload');
await db.exec('reset role');assert.equal((await db.query("select count(*)::int n from storage.objects where name like $1",[path+'%'])).rows[0].n,4,'Storage originals and derivatives never deleted');
await as('anon');assert.equal((await db.query("select * from storage.objects where name like $1",[path+'%'])).rows.length,0);await db.exec('reset role');
console.log('PASS: migration 005 repeat-safe metadata removal, preserved original Storage objects, removed access.');
const migration006=await readFile(new URL('../supabase/migrations/006_staged_variant_uploads.sql',import.meta.url),'utf8');await db.exec(migration006);await db.exec(migration006);
const legacyPath=d.id+'/'+image;await as('authenticated',admin);await db.query("insert into storage.objects(bucket_id,name) values('project-media',$1)",[legacyPath+'/content.webp']);
assert.equal((await db.query('select public.a45_media_access($1,true) allowed',[legacyPath+'/wrong.webp'])).rows[0].allowed,false);
await as('anon');assert.equal((await db.query("select * from storage.objects where name=$1",[legacyPath+'/content.webp'])).rows.length,0);await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('project-media',$1)",[legacyPath+'/large.webp']));await as('authenticated',other);await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('project-media',$1)",[legacyPath+'/large.webp']));await db.exec('reset role');
console.log('PASS: migration 006, admin-only deterministic staged variants, hidden unregistered derivatives, denied outsider uploads.');
await db.close();console.log('PASS: project SQL atomic saves, multi-category/draft/publish/unpublish, immutable slug, conflict rejection, private draft/staged media, RLS, denied outsider writes, repeat migration and untouched 45 categories.');
