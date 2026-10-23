import assert from 'node:assert/strict';
import {createProjectCardEditor} from '../src/project-card.mjs';
import {newProject,newTab} from '../src/project-model.mjs';
const original=newProject('studio-photo');original.title='Сумерки';original.description='Описание';original.status='published';original.revision=7;original.tabs.push(newTab('Фотографии'));original.tabs[0].blocks.push({id:crypto.randomUUID(),type:'TEXT',content:{text:'Содержимое проекта'}});
const tabs=structuredClone(original.tabs);let stored=structuredClone(original),fail=false,seenPending;
const save=createProjectCardEditor({service:{async get(){return structuredClone(stored)},async mediaUrls(){return {}},async publicUrls(doc){return doc.coverMediaId?{[doc.coverMediaId]:'https://example.org/new-cover.webp'}:{}},async save(doc,pending,status){if(fail)throw Error('Нет сети');assert.equal(status,'published');seenPending=pending.size;doc.revision++;stored=structuredClone(doc)}},prepare:async()=>({width:800,height:600,thumbnail:new Blob(['thumb']),content:new Blob(['content']),large:new Blob(['large'])})});
let result=await save({id:original.id,title:'Сумерки — портреты',description:'Полное описание',image:'https://example.org/old.jpg'});assert.equal(result.project.title,'Сумерки — портреты');assert.equal(result.project.description,'Полное описание');assert.deepEqual(stored.tabs,tabs);assert.equal(stored.revision,8);assert.equal(seenPending,0);assert.equal(result.project.image,'https://example.org/old.jpg');
const file=new Blob(['photo'],{type:'image/jpeg'});Object.defineProperty(file,'name',{value:'cover.jpg'});result=await save({id:original.id,title:stored.title,description:stored.description,file});assert.deepEqual(stored.tabs,tabs);assert.equal(stored.coverMediaId,stored.coverOriginalId);assert.equal(seenPending,1);assert.equal(result.project.image,'https://example.org/new-cover.webp');
fail=true;await assert.rejects(()=>save({id:original.id,title:'Не сохранено',description:'Черновик'}),/Нет сети/);assert.notEqual(stored.title,'Не сохранено');fail=false;await save({id:original.id,title:'Повторная попытка',description:'Описание'});assert.equal(stored.title,'Повторная попытка');assert.deepEqual(stored.tabs,tabs);
console.log('PASS: card metadata/cover editing preserves all tabs/content, publication, existing cover, versions and retry.');

assert(!result.project.tabs[0].content.some(b=>b.type==='image'&&b.content.src==='https://example.org/new-cover.webp'),'selecting a card cover never inserts it into project content');

stored.categoryIds=['studio-photo','video'];const coverBefore=stored.coverMediaId;
fail=true;await assert.rejects(save({id:original.id,title:stored.title,description:stored.description,categoryId:'eco'}),/Нет сети/);assert.equal(stored.primaryCategoryId,'studio-photo');
fail=false;result=await save({id:original.id,title:stored.title,description:stored.description,categoryId:'eco'});assert.equal(stored.primaryCategoryId,'eco');assert.deepEqual(stored.categoryIds,['eco','video']);assert.deepEqual(stored.tabs,tabs);assert.equal(stored.coverMediaId,coverBefore);assert.deepEqual(result.project.categoryIds,['eco','video']);
console.log('PASS: moving a project preserves content, cover, additional placements and retry.');
