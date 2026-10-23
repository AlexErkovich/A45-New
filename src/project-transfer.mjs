import {uid,publicProject} from './project-model.mjs';
import {serializeCanvas} from './canvas-model.mjs';
import {prepareImage} from './image-optimizer.mjs';
import {ensureCategory} from './category-placement.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const read=(storage,key,fallback)=>{try{return JSON.parse(storage.getItem(key)||'null')||fallback}catch{throw Error('Повреждены локальные данные: '+key+'. Сначала скачайте резервную копию.')}};
export function localTransferRecords(storage,recoveries=[]){const saved=read(storage,'a45-project-drafts',{}),receipts=read(storage,'a45-transfer-receipts',{}),records=new Map();for(const [id,record] of Object.entries(saved))if(!receipts[id])records.set(id,{id,doc:record.doc,pending:[],source:'saved'});for(const record of recoveries)records.set(record.id,{...record,source:'recovery'});return [...records.values()]}
export function currentPlacement(id,catalog,legacy){const byId=new Map(legacy.map(c=>[c.id,c])),seen=new Set();if(id==='film-equipment')id='camera-equipment';for(let c=byId.get(id)||{id};c&&!seen.has(c.id);c=byId.get(c.parentId)){if(catalog.some(x=>x.id===c.id))return c.id;seen.add(c.id)}return null}
export async function makeBackup(storage,recovery){const keys=['a45-project-drafts','a45-home-drafts','a45-hidden-projects','a45-transfer-receipts'];const local=Object.fromEntries(keys.map(key=>[key,storage.getItem(key)]));const records=[];for(const r of await recovery.list()){const pending=[];for(const [id,entry] of r.pending||[]){const files=[];for(const item of entry.files||[{path:r.doc.id+'/'+id,file:entry}]){const bytes=new Uint8Array(await item.file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));files.push({path:item.path,name:item.file.name||'photo',type:item.file.type,data:btoa(binary)})}pending.push([id,{files}])}records.push({...r,pending})}return {format:'a45-backup',version:1,createdAt:new Date().toISOString(),local,recovery:records}}
export async function restoreBackup(backup,storage,recovery){if(backup?.format!=='a45-backup'||backup.version!==1||!backup.local||!Array.isArray(backup.recovery))throw Error('Это не резервная копия A45.');const allowed=['a45-project-drafts','a45-home-drafts','a45-transfer-receipts'];for(const key of allowed){if(!backup.local[key])continue;const incoming=JSON.parse(backup.local[key]);if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))throw Error('Повреждён раздел резервной копии: '+key);const existing=read(storage,key,{});for(const [id,value] of Object.entries(incoming))if(!['__proto__','constructor','prototype'].includes(id)&&!Object.hasOwn(existing,id))existing[id]=value;storage.setItem(key,JSON.stringify(existing))}for(const record of backup.recovery){if(await recovery.get(record.id))continue;const pending=(record.pending||[]).map(([id,entry])=>[id,{files:entry.files.map(f=>{const binary=atob(f.data),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return {path:f.path,file:new File([bytes],f.name,{type:f.type})}})}]);await recovery.put({...record,pending})}}
export function createProjectTransfer({projectService,categoryService,storage,prepare=prepareImage,fetchFile=async url=>{if(!/^(data:image\/(jpeg|png|webp);base64,|\/?assets\/)/.test(url))throw Error('Файл доступен только в старой вкладке. Восстановите его из оригинала перед переносом.');const response=await fetch(url);if(!response.ok)throw Error('Не найден локальный файл.');return response.blob()}}){
 return async function transfer(record,{categoryId,expectedRevision,onProgress=()=>{}}){
  if(!await categoryService.isAdmin(true))throw Error('Для переноса войдите администратором.');
  const source=record.doc,doc=serializeCanvas(source),sourceId=doc.id;let existing=null;
  if(uuid.test(doc.id)){try{existing=await projectService.get(doc.id)}catch(error){if(!['PGRST116','PGRST505'].includes(error.code))throw error}}
  if(existing&&expectedRevision!==existing.revision)throw Error('Серверный проект изменился после проверки. Обновите список и снова проверьте перенос.');
  doc.id=existing?.id||(uuid.test(sourceId)?sourceId:uid());doc.revision=existing?.revision||0;doc.primaryCategoryId=categoryId;doc.categoryIds=[categoryId];delete doc.localOnly;delete doc.cardImage;
  const rows=await categoryService.listAdmin();await ensureCategory(categoryService,categoryId,new Set(rows.map(r=>r.id)));
  const staged=new Map(record.pending||[]),pending=new Map();
  if(!doc.coverMediaId&&source.cardImage&&!source.cardImage.endsWith('cover-placeholder.svg')){const match=doc.media.find(m=>m.kind==='image'&&(m.localUrl===source.cardImage||m.path===source.cardImage));if(match)doc.coverMediaId=match.id;else{const id=uid();doc.media.push({id,name:'Обложка проекта',kind:'cover',localUrl:source.cardImage,alt:doc.title,caption:''});doc.coverMediaId=id}}

  for(const media of doc.media){
   const entry=staged.get(media.id),local=media.localUrl||(!existing&&media.path?.startsWith('assets/')?media.path:null);
   if(!entry&&!local){if(existing?.media.some(m=>m.id===media.id))continue;throw Error('Нет оригинала файла «'+media.name+'». Перенос остановлен без удаления локальной копии.')}
   const file=entry?.files?.[0]?.file||(entry instanceof Blob?entry:await fetchFile(local));
   if(!file?.size)throw Error('Пустой файл: '+media.name);const path=doc.id+'/'+media.id;
   if(['image','cover','original'].includes(media.kind)){const output=await prepare(file,undefined,onProgress),variants={},files=[{path,file}];for(const kind of ['thumbnail','content','large']){variants[kind]=path+'/'+kind+'.webp';files.push({path:variants[kind],file:output[kind]})}Object.assign(media,{path,variants,width:output.width,height:output.height,mimeType:file.type,size:file.size});pending.set(media.id,{files})}
   else{media.path=path;media.size=file.size;pending.set(media.id,{files:[{path,file}]})}
   delete media.localUrl;
  }
  await projectService.save(doc,pending,source.status||'draft',onProgress);
  const verified=await projectService.get(doc.id);if(verified.revision!==doc.revision||verified.title!==doc.title||verified.media.length!==doc.media.length)throw Error('Проверка серверной копии не завершена. Локальный оригинал сохранён; повторите проверку.');
  const receipts=read(storage,'a45-transfer-receipts',{});receipts[sourceId]={id:verified.id,slug:verified.slug,revision:verified.revision,at:new Date().toISOString()};storage.setItem('a45-transfer-receipts',JSON.stringify(receipts));
  return {doc:verified,project:publicProject(verified,await projectService.publicUrls(verified)),sourceId};
 };
}
