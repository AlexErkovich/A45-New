import assert from 'node:assert/strict';
import {newProject,uid} from '../src/project-model.mjs';
import {createProjectService} from '../src/project-service.mjs';
let stored=newProject('technical');stored.title='Файлы';stored.revision=1;stored.status='published';
const doc=structuredClone(stored),a=uid(),b=uid(),files=[new File(['first'],'one.txt',{type:'text/plain'}),new File(['second'],'two.txt',{type:'text/plain'})];
for(const [i,id] of [a,b].entries())doc.media.push({id,kind:'file',name:files[i].name,path:doc.id+'/'+id,mimeType:'text/plain',size:files[i].size});
const pending=new Map([[a,files[0]],[b,files[1]]]),uploads=new Map();let fail=true;
const row=()=>({id:stored.id,title:stored.title,description:stored.description,year:stored.year,primary_category_id:stored.primaryCategoryId,status:stored.status,revision:stored.revision,project_categories:stored.categoryIds.map(category_id=>({category_id})),project_media:stored.media.map(m=>({...m,mime_type:m.mimeType})),project_tabs:stored.tabs.map(t=>({...t,sort_order:t.sortOrder})),project_blocks:[]});
const client={
 from(){return {select(){return this},eq(){return this},async single(){return {data:row()}}}},
 async rpc(name,{doc:next,expected_revision}){assert.equal(expected_revision,stored.revision);stored={...structuredClone(next),revision:stored.revision+1,slug:'retry-project'};return {data:{revision:stored.revision,slug:stored.slug}}},
 storage:{from(){return {
  async upload(path,file){if(path.endsWith(b)&&fail)return {error:{message:'Offline'}};if(uploads.has(path))return {error:{message:'Exists'}};uploads.set(path,file);return {}},
  async download(path){return uploads.has(path)?{data:uploads.get(path)}:{error:{message:'Missing'}}}
 }}}
};

const service=createProjectService(client,{async isAdmin(){return true}});
await assert.rejects(service.save(doc,pending,'published'),/two.txt/);assert.equal(pending.size,2,'successful staged files remain in pending snapshot until final commit');
fail=false;await service.save(doc,pending,'published');assert.equal(pending.size,0);assert.equal(stored.media.length,2);assert.equal(uploads.size,2);
console.log('PASS: partial file failure and retry retain all media through the final atomic commit.');
