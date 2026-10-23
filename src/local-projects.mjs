import {newProject,newTab,uid,publicProject} from './project-model.mjs';
// Local examples remain editable without granting access to cloud records.
export function withLocalProjects(remote,storage=localStorage){
 let migrated={};try{migrated=JSON.parse(storage.getItem('a45-transfer-receipts')||'{}')}catch{};migrated=Object.fromEntries(Object.entries(migrated||{}).filter(([,receipt])=>typeof receipt?.id==='string'&&typeof receipt?.slug==='string'));for(const id of Object.keys(migrated)){const index=window.archiveData.projects.findIndex(p=>p.id===id&&!p.cloud);if(index>=0)window.archiveData.projects.splice(index,1)}
 let saved={};try{saved=JSON.parse(storage.getItem('a45-project-drafts')||'{}')}catch{}
 const local=id=>window.archiveData.projects.find(p=>!p.cloud&&(p.id===id||p.slug===id));
 const urls=doc=>Object.fromEntries(doc.media.map(m=>[m.id,m.localUrl||m.path]));
 function publish(doc){const original=window.archiveData.projects.find(p=>p.id===doc.id);const p={...publicProject(doc,urls(doc)),cloud:false,archived:doc.status!=='published',slug:doc.slug||doc.id,overviewTitle:doc.tabs[0]?.title};if(original)Object.assign(original,p);else window.archiveData.projects.push(p);return p}
 for(const record of Object.values(saved)){if(!migrated[record.doc.id]&&(local(record.doc.id)||record.doc.localOnly)){publish(record.doc);if(record.doc.localOnly&&remote?.publicUrls)Promise.resolve(remote.publicUrls(record.doc)).then(urls=>{const p=publicProject(record.doc,{...urls,...Object.fromEntries(record.doc.media.filter(m=>m.localUrl).map(m=>[m.id,m.localUrl]))}),current=local(record.doc.id);if(current){Object.assign(current,p,{cloud:false,archived:record.doc.status!=='published'});window.dispatchEvent(new Event('a45-home-change'))}}).catch(()=>{})}}
 function convert(p){const doc={...newProject(p.categoryIds[0]),id:p.id,slug:p.slug,title:p.title,description:p.description,cardImage:p.image,year:p.year,categoryIds:[...p.categoryIds],status:'published'};
 const media=(source,kind='image')=>{const id=uid();doc.media.push({id,path:source,localUrl:source,name:source.split('/').pop(),kind,mimeType:kind==='image'?'image/jpeg':'application/octet-stream',size:0});return id};
 const blocks=(type,c)=>{
 if(type==='mixed')return c.flatMap(b=>blocks(b.type,b.content));
 if(type==='text')return [...(c.heading?[{id:uid(),type:'HEADING',content:{text:c.heading}}]:[]),...(c.paragraphs?.length?[{id:uid(),type:'TEXT',content:{text:c.paragraphs.join('\n\n')}}]:[]),...(c.steps?[{id:uid(),type:'LIST',content:{text:c.steps.join('\n')}}]:[])];
 if(type==='richtext'||type==='heading')return [{id:uid(),type:type==='heading'?'HEADING':'TEXT',content:{text:c.text}}];
 if(type==='image')return [{id:uid(),type:'IMAGE',content:{mediaId:media(c.src),caption:c.caption||''}}];
 if(type==='gallery')return c.images?.length?[{id:uid(),type:'GALLERY',content:{items:c.images.map(i=>({mediaId:media(i.src),caption:i.caption||''}))}}]:[];
 if(type==='files')return (c.files||[]).map(f=>({id:uid(),type:'FILE',content:{mediaId:media(f.url,'file')}}));
 if(type==='divider')return [{id:uid(),type:'DIVIDER',content:{}}];
 return [{id:uid(),type:'LEGACY',content:{type,content:c}}]};
 doc.tabs=p.tabs.map(t=>({...newTab(t.title,t.id==='overview'),key:t.id,sortOrder:t.sortOrder,blocks:blocks(t.type,t.content).map((b,i)=>({...b,sortOrder:i}))}));return doc}
 const api={isLocal:id=>!!local(id),async get(id){if(!local(id))return remote.get(id);return structuredClone(saved[id]?.doc||convert(local(id)))},async mediaUrls(doc){if(doc.localOnly&&remote?.mediaUrls)return {...await remote.mediaUrls({...doc,media:doc.media.filter(m=>!m.localUrl)}),...Object.fromEntries(doc.media.filter(m=>m.localUrl).map(m=>[m.id,m.localUrl]))};return local(doc.id)?urls(doc):remote.mediaUrls(doc)},async save(doc,pending,status,progress=()=>{}){const caller=doc;if(!local(doc.id)){try{return await remote.save(doc,pending,status,progress)}catch(error){if(!/Existing materials cannot be replaced through creation|belongs to another browser/i.test(error.message||''))throw error;doc={...doc,localOnly:true};progress('Сохранение в этом браузере…')}}
  const next=structuredClone(doc);for(const [id,item] of pending){progress('Загрузка файла: '+(doc.media.find(m=>m.id===id)?.name||''));const file=item.files?.[0]?.file||item;if(!file)continue;const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});const media=next.media.find(m=>m.id===id);if(media)media.localUrl=data;progress('Загружен файл: '+(media?.name||''))}
  next.revision=(next.revision||0)+1;next.status=status||next.status;const records={...saved,[next.id]:{doc:next}};storage.setItem('a45-project-drafts',JSON.stringify(records));saved=records;Object.assign(caller,next);publish(caller);return caller}
 };
 return new Proxy(api,{get(target,key){return key in target?target[key]:typeof remote?.[key]==='function'?remote[key].bind(remote):remote?.[key]}})
}
