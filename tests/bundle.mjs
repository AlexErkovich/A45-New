// Boot the actual built HTML/scripts with the official SDK and a fake HTTP boundary.
import { Window } from 'happy-dom';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../dist/',import.meta.url),window=new Window({url:'http://127.0.0.1:3001/'}),errors=[];
window.structuredClone=structuredClone;
window.addEventListener('error',e=>errors.push(e.message));
Object.defineProperty(window.document,'scrollingElement',{value:window.document.documentElement});
let localData;
const requests=[];
window.fetch=async input=>{const url=new URL(typeof input==='string'?input:input.url);requests.push(url.pathname);
 if(url.pathname==='/rest/v1/rpc/get_a45_navigation')return new window.Response(JSON.stringify({entries:null,revision:0}),{status:200,headers:{'Content-Type':'application/json'}});
 if(url.pathname==='/rest/v1/categories')return new window.Response(JSON.stringify(localData.categories.map(c=>({id:c.id,parent_id:c.parentId,slug:c.slug,title:c.id==='photography'?'Фотография из облака':c.title,description:c.description,sort_order:c.sortOrder,cover_image_path:c.id==='photography'?'photography/40733d9e-c410-4919-9fdb-398154011a30.webp':c.id==='video'?'video/9c24c1be-1e21-4a0e-a2cf-b0d25064ef47.webp':null,is_published:true,updated_at:'2026-10-16T00:00:00Z'}))),{status:200,headers:{'Content-Type':'application/json'}});
 if(url.pathname==='/rest/v1/projects')return new window.Response(JSON.stringify([{id:'11111111-1111-4111-8111-111111111111',slug:'p-11111111-1111-4111-8111-111111111111',title:'Облачный проект',description:'Описание из базы',year:2026,primary_category_id:'technical',status:'published',revision:1,project_categories:[{category_id:'technical'},{category_id:'video'}],project_tabs:[{id:'22222222-2222-4222-8222-222222222222',key:'overview',title:'Обзор',sort_order:0},{id:'33333333-3333-4333-8333-333333333333',key:'history',title:'История',sort_order:1}],project_blocks:[{id:'44444444-4444-4444-8444-444444444444',tab_id:'33333333-3333-4333-8333-333333333333',type:'TEXT',sort_order:0,content:{text:'**Безопасный текст** <script>alert(1)</script>'}}],project_media:[] }]),{status:200,headers:{'Content-Type':'application/json'}});
 throw new Error('Unexpected test HTTP request: '+url.pathname);
};
let html=await readFile(new URL('index.html',root),'utf8');
const scriptNames=[...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)].map(match=>match[1].split('?')[0]);
const stylesheetNames=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map(match=>match[1]).filter(name=>!/^https?:/.test(name)).map(name=>name.split('?')[0]);
for(const name of stylesheetNames){const css=await readFile(new URL(name,root),'utf8');html=html.replace(new RegExp('<link\\b[^>]*href="'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\?[^"]*)?"[^>]*>'),`<style data-stylesheet="${name}">${css}</style>`)}
html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*href="https?:[^>]*>/g,'');window.document.write(html);
assert.deepEqual(stylesheetNames,['design-tokens.css','styles.css','ui.css','admin.css']);assert.equal(window.document.querySelectorAll('style[data-stylesheet]').length,4);
assert(scriptNames.includes('icons.js')&&scriptNames.includes('feedback.js'));
const scripts=await Promise.all(scriptNames.map(name=>readFile(new URL(name,root),'utf8')));localData=JSON.parse(scripts[scriptNames.indexOf('data/projects.js')].replace('window.archiveData = ','').trim().replace(/;$/,''));
// Happy DOM isolates lexical bindings between eval calls; a single evaluation models shared classic script scope.
window.eval(scripts.join('\n;\n'));
async function until(test){for(let i=0;i<200;i++){if(test())return;await new Promise(r=>setTimeout(r,5))}throw new Error('Built app failed to reach expected state: '+errors.join('; '))}
// Without configured Supabase, local fallback is expected; with config, await the SDK fetch.
await until(()=>window.document.querySelectorAll('[data-category-card]').length===10);
if(window.A45Cloud.configured){await until(()=>window.document.querySelector('[data-category-card="photography"] h2').textContent==='Фотография из облака');assert(requests.includes('/rest/v1/categories'));assert(window.document.querySelector('[data-category-card=photography] img').getAttribute('src').includes('photography/40733d9e-c410-4919-9fdb-398154011a30.webp'));assert(window.document.querySelector('[data-category-card=video] img').getAttribute('src').includes('video/9c24c1be-1e21-4a0e-a2cf-b0d25064ef47.webp'))}
assert(window.A45Feedback&&window.A45Icons.plus);assert(!window.document.querySelector('[contenteditable]'));assert.equal(window.A45Cloud.visual,undefined);assert(!window.document.querySelector('#visual-controls'));
if(window.A45Cloud.configured){await until(()=>window.archiveData.projects.some(p=>p.cloud));window.history.pushState(null,'','/#/project/p-11111111-1111-4111-8111-111111111111?tab=history');window.dispatchEvent(new window.Event('hashchange'));await until(()=>window.document.querySelector('.project-prose strong'));assert.equal(window.document.querySelector('.project-prose strong').textContent,'Безопасный текст');assert(!window.document.querySelector('.project-prose script'));assert(window.document.querySelector('.project-prose').textContent.includes('<script>'));}
if(window.A45Cloud.configured){assert.equal(window.A45Cloud.onlineOnly,true);assert(window.archiveData.projects.every(p=>p.cloud),'local demo projects cannot shadow cloud projects');window.history.pushState(null,'','/project/new?category=technical');window.dispatchEvent(new window.Event('hashchange'));await until(()=>!!window.document.querySelector('#admin-login-form'));assert(!window.document.querySelector('#project-edit-form'),'anonymous users cannot edit even on localhost');assert(!requests.some(p=>p.includes('a45_open_')),'temporary creation RPCs are never used')}
window.history.pushState(null,'','/login');window.dispatchEvent(new window.Event('hashchange'));
await until(()=>window.document.querySelector('#admin-login-form')||window.document.querySelector('#main').textContent.includes('Supabase не настроен'));
assert.equal(window.document.title,'Вход администратора — A45');
window.history.pushState(null,'','/admin');window.dispatchEvent(new window.Event('hashchange'));
await until(()=>!!window.document.querySelector('#admin-login-form'));assert.equal(window.document.querySelector('.admin-layout'),null);assert.equal(window.location.pathname,'/login');
if(window.A45Cloud.configured){const original=window.archiveData.projects.find(p=>p.cloud);const migrated={...structuredClone(original),id:'b14018ae-3906-4a60-a70b-7cc5490c8412',slug:'p-b14018ae-3906-4a60-a70b-7cc5490c8412',title:'Теплица с сервера',cloud:true};window.dispatchEvent(new window.CustomEvent('a45-projects',{detail:[migrated]}));assert(!window.archiveData.projects.some(p=>p.id==='automatic-greenhouse'),'migrated seed must not duplicate the server project');window.history.pushState(null,'','/#/project/automatic-greenhouse?category=eco');window.dispatchEvent(new window.Event('hashchange'));assert.equal(window.document.querySelector('.project-title h1').textContent,'Теплица с сервера','old project link resolves to the server version')}
const documentHost=window.document.createElement('section');documentHost.innerHTML=window.A45Documents.render([{id:'doc-test',name:'package.zip',title:'Материалы',caption:'Документы проекта',size:2048,url:'https://files.test/package.zip'}]);window.document.body.append(documentHost);documentHost.querySelector('[data-open-document]').click();assert(window.document.querySelector('.document-dialog').open);await until(()=>window.document.querySelector('.document-format-preview'));assert(window.document.querySelector('.document-dialog a[download]'));assert.equal(window.document.querySelector('.document-dialog [data-document-title]'),null);window.document.querySelector('[data-document-close]').click();documentHost.remove();
for(const file of ['pdf-preview.js','pdf.worker.min.mjs','pdf-assets/LICENSE'])assert((await readFile(new URL(file,root))).length>0);
assert.deepEqual(errors,[]);await window.happyDOM.close();
console.log('PASS: built app boots with official Supabase SDK, cloud-only project loading, mandatory administrator session, real script order and styles, feedback/icons, ten navigation-aligned cards, /login, redirected /admin, private /project/new and cloud project deep tab; no DOM runtime errors. HTTP is mocked.');

const integration=await readFile(new URL("integration.js",root),"utf8");assert(!integration.includes("Режим редактирования"));assert(!integration.includes("visual-controls"));
