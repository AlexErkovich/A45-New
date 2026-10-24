import assert from 'node:assert/strict';
import {createCardCreation} from '../src/card-creation.mjs';
const categories=[{id:'photography',parentId:null,title:'Фотография',description:''},{id:'studio-photo',parentId:'photography',title:'Студийная',description:''}];
globalThis.window={archiveData:{categories}};
const rows=new Map([['photography',{id:'photography',parent_id:null,title:'Фотография',is_published:true}]]),stored=new Map();
let admin=true,failUpload=true,failProject=true,refreshes=0,prepares=0,projectCalls=0;
const service={
 async save(previous,changes){const next={...previous,title:changes.title,description:changes.description};if(changes.removeCover)next.cover_image_path=null;if(changes.blob){next.cover_image_path=previous.id+'/'+crypto.randomUUID()+'.png';if(failUpload)throw Error('Не удалось загрузить обложку');stored.set(next.cover_image_path,changes.blob)}rows.set(next.id,next);return {category:next}},
 async isAdmin(){return admin},async listAdmin(){return [...rows.values()]},coverUrl:p=>'https://example.org/'+p,
 client:{
  async rpc(name,args){
   if(name==='create_a45_category'){const d=args.doc;if(!rows.has(d.id))rows.set(d.id,{id:d.id,parent_id:d.parentId,title:d.title,description:d.description,cover_image_path:d.coverPath||null,is_published:!d.coverPath,slug:d.id,sort_order:99});return {data:[rows.get(d.id)]}}
   const row=rows.get(args.category_id);assert(!row.cover_image_path||stored.has(row.cover_image_path));row.is_published=true;return {data:[row]};
  },
  storage:{from(){return {
   async upload(path,file){if(failUpload)return {error:{message:'Offline'}};stored.set(path,file);return {}},
   async download(path){return stored.has(path)?{data:stored.get(path)}:{error:{message:'Missing'}}}
  }}}
 }
};
const projectService={async save(doc,pending,status){projectCalls++;assert.equal(status,'published');assert.deepEqual(doc.categoryIds,['studio-photo']);assert.equal(doc.coverMediaId,doc.media.at(-1)?.id||null);doc.revision++;if(failProject)throw Error('Upload failed');doc.slug='p-'+doc.id;pending.clear()},async publicUrls(doc){if(!doc.coverMediaId)return {};return {[doc.coverMediaId]:'https://example.org/content.webp',thumbnail:{[doc.coverMediaId]:'https://example.org/thumbnail.webp'}}}};
const create=createCardCreation({categoryService:service,projectService,refreshCategories:async()=>refreshes++,refreshProjects:async()=>refreshes++,prepare:async()=>{prepares++;return {thumbnail:new Blob(['thumbnail']),content:new Blob(['content']),large:new Blob(['large']),width:200,height:100}}}).create;
const file=new Blob(['image'],{type:'image/png'}),input={kind:'subcategory',id:'section-00000000-0000-4000-8000-000000000003',parentId:'photography',title:'Туристические',description:'Описание',file};
admin=false;await assert.rejects(create(input),/администратором/);assert.equal(rows.size,1);
admin=true;await assert.rejects(create(input),/обложку/);assert.equal(rows.get(input.id).is_published,false);
failUpload=false;input.title='Исправленное название';input.description='Исправленное описание';input.file=new Blob(['other'],{type:'image/png'});const saved=await create(input);assert.equal(saved.category.title,input.title);assert.equal(saved.category.description,input.description);assert.equal(saved.category.parentId,'photography');assert.equal(saved.category.custom,true);assert.equal(rows.get(input.id).is_published,true);assert.equal(rows.size,2);
const project={kind:'project',id:'00000000-0000-4000-8000-000000000004',parentId:'studio-photo',title:'Съёмка',description:'Описание',file};
await assert.rejects(create(project),/Upload failed/);assert.equal(rows.get('studio-photo').parent_id,'photography');
failProject=false;const result=await create(project);assert.equal(prepares,1,'retry reuses prepared media and revision');assert.equal(projectCalls,2);assert.equal(result.project.image,'https://example.org/thumbnail.webp');assert.deepEqual(result.project.categoryIds,['studio-photo']);assert.equal(result.project.slug,'p-'+project.id);assert.equal(refreshes,2);
console.log('PASS: admin gate, persisted category parents, staged cover retry, missing ancestor creation, optimized project cover and retry without duplicate media.');

for(const kind of ['project','subcategory']){await assert.rejects(create({kind,id:crypto.randomUUID(),parentId:'studio-photo',title:'   '}),/название/);const result=await create({kind,id:crypto.randomUUID(),parentId:'studio-photo',title:'Только название'});const card=result.project||result.category;assert.equal(card.description,'');assert.equal(card.image,'assets/cover-placeholder.svg')}
console.log('PASS: title-only project and subsection creation; blank titles rejected.');
