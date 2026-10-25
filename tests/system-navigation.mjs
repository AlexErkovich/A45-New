import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=new URL('../',import.meta.url).pathname.replace(/\/$/,''),require=createRequire(root+'/package.json');
const {Window}=await import(pathToFileURL(require.resolve('happy-dom')));
const ui=await import(pathToFileURL(root+'/src/ui/components.mjs'));
const routes=await import(pathToFileURL(root+'/src/access-routes.mjs'));
const {publicProject,fromRow,richText,safeUrl}=await import(pathToFileURL(root+'/src/project-model.mjs'));
const catalog=JSON.parse(await readFile(root+'/tests/fixtures/system-catalog.json','utf8'));
const navIds=new Set(catalog.navigation.entries.map(c=>c.id));const cats=catalog.categories.filter(c=>navIds.has(c.id));
const projects=catalog.projects.map(row=>{const p=structuredClone(row);p.project_blocks=p.project_blocks.map(b=>({...b,content:b.type==='TEXT'?{text:'Audit text'}:b.type==='GALLERY'?{items:[]}:{}}));p.project_media=p.project_media.map(m=>({...m,path:'audit/'+m.id,name:'audit.png',mime_type:'image/png',size:8}));return publicProject(fromRow(p))});
const html=(await readFile(root+'/index.html','utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'');
let source='';for(const f of ['data/projects.js','project-page.js','icons.js','feedback.js','home-page.js','card-motion.js','app.js'])source+=(await readFile(root+'/'+f,'utf8'))+'\n;\n';
const css=[];for(const f of ['design-tokens.css','styles.css','ui.css','admin.css'])css.push(await readFile(root+'/'+f,'utf8'));
const findings=[],checks=[];
function finding(name,details){findings.push({name,...details});console.log('CONFIRMED: '+name)}
function assertDisclosure(w){
 const block=w.document.querySelector('#archive [data-active="true"]');
 if(!block)return;
 const branch=block.querySelector('.menu-block-items');
 assert.equal(block.querySelector('.menu-block-title').getAttribute('aria-expanded'),'true','active ancestor opens automatically');
 if(branch.children.length){assert.equal(branch.hidden,false);assert.equal(branch.inert,false)}
}
function go(w,path){w.history.replaceState(null,'',path);w.dispatchEvent(new w.Event('hashchange'));assertDisclosure(w)}
async function boot(path,role,restoreEditing=false){
 const w=new Window({url:'https://example.test'+path,settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});w.auditErrors=[];w.addEventListener('error',event=>w.auditErrors.push(event.message));w.structuredClone=structuredClone;w.matchMedia=()=>({matches:true,addEventListener(){}});w.A45UI=ui;w.A45Routes=routes;w.A45Management=false;
 if(restoreEditing)w.sessionStorage.setItem('a45-admin-listing-edit','1');w.document.write(html);const nativePush=w.history.pushState.bind(w.history);w.history.pushState=(state,title,url)=>nativePush(state,title,new URL(url,w.document.baseURI).href);for(const text of css){const s=w.document.createElement('style');s.textContent=text;w.document.head.append(s)}
 w.A45Cloud={configured:true,onlineOnly:true,richText,safeUrl,projectEditor:{beforeRouteChange(){return true},mount(){w.document.querySelector('#main').textContent='Editor mock'}},releaseImage(){},
  authorizeManagement(){if(!role){go(w,'/login');return}w.A45Management=true;w.document.querySelector('#navigation').replaceChildren();ui.renderManagementNavigation({document:w.document,active:true});w.dispatchEvent(new w.Event('hashchange'))},
  leaveManagement(){w.A45Management=false;ui.clearManagementNavigation({document:w.document})},
  start(cb){w.auditRefresh=(rows=cats)=>cb(rows,()=>'',{navigation:catalog.navigation.entries})},
  mountLogin(){w.document.querySelector('#main').innerHTML='<form id="admin-login-form"></form>'},async listDraftProjects(){return []}};
 w.eval(source+';window.auditState=()=>({route,renderedContext});');w.auditRefresh();w.dispatchEvent(new w.CustomEvent('a45-projects',{detail:projects.map(p=>structuredClone(p))}));assertDisclosure(w);return w;
}
const tools='#home-edit,#home-add,#section-edit,#section-add,[data-nav-add],#management-navigation';
const paths=['/#/about',...cats.map(c=>'/#/category/'+c.id),...projects.map(p=>'/#/project/'+p.slug)];
let direct=0,transition=0;
for(const role of [false,true]){
 const w=await boot('/',role);
 for(const path of paths){go(w,path);assert.equal(w.A45Management,false);assert.equal(w.document.querySelector(tools)===null,true,'public controls absent: '+path);assert.equal(w.document.querySelector('#navigation').textContent.trim(),'');assert.equal(w.document.querySelectorAll('footer .footer-about a[href="/#/about"]').length,1);transition++}
 await w.happyDOM.close();
}
const admin=await boot('/admin',true);
for(const path of paths.filter(p=>!p.includes('/about'))){go(admin,'/admin'+path.slice(1));assert(admin.document.querySelector('#section-edit'));assert(admin.document.querySelector('#section-add'));assert(admin.document.querySelector('footer #management-navigation'));assert.equal(admin.document.querySelector('#navigation').textContent.trim(),'');transition++}
// Model native History API URL resolution against <base href="/">, not Happy DOM's location fallback.
go(admin,'/admin#/category/technical');admin.document.querySelector('#section-edit').click();
for(const category of cats.filter(c=>c.parent_id===null)){
 admin.document.querySelector('#archive .menu-block-title[data-category="'+category.id+'"]').click();
 assert.equal(admin.location.pathname,'/admin','tree click must preserve admin with a document base');
 assert.equal(admin.A45Management,true);assert.equal(admin.document.querySelector('#section-edit').getAttribute('aria-pressed'),'true');
}
admin.document.querySelector('#section-edit').click();
const restoredAdmin=await boot('/admin#/category/technical',true,true);
assert.equal(restoredAdmin.document.querySelector('#section-edit').getAttribute('aria-pressed'),'true','reload restores selection only after authorization');
restoredAdmin.document.querySelector('#section-edit').click();assert.equal(restoredAdmin.sessionStorage.getItem('a45-admin-listing-edit'),null,'Done clears saved mode');
await restoredAdmin.happyDOM.close();
const deniedRestore=await boot('/admin#/category/technical',false,true);assert.equal(deniedRestore.A45Management,false);assert.equal(deniedRestore.sessionStorage.getItem('a45-admin-listing-edit'),null);await deniedRestore.happyDOM.close();
const first=cats.find(c=>c.id==='technical'),second=cats.find(c=>c.id==='photography');
go(admin,'/admin#/category/technical');
admin.document.scrollingElement.scrollTop=230;
admin.document.querySelector('#archive [data-category="technical"]').click();
assert.equal(admin.document.querySelector('#branch-technical').hidden,true,'manual collapse remains available');
admin.auditRefresh();
assert.equal(admin.document.querySelector('#branch-technical').hidden,true,'data refresh respects manual collapse');
assert.equal(admin.document.scrollingElement.scrollTop,230,'collapse/refresh do not scroll document to top');
go(admin,'/admin#/category/photography');assert.equal(admin.document.scrollingElement.scrollTop,230,'category transition preserves document position');
go(admin,'/admin');go(admin,'/admin#/category/technical');
checks.push('automatic active-ancestor disclosure, manual collapse and scroll preservation');

go(admin,'/admin#/category/'+first.id);admin.document.querySelector('#section-edit').click();assert.equal(admin.document.querySelector('#section-edit').getAttribute('aria-pressed'),'true');admin.auditRefresh();assert.equal(admin.document.querySelector('#section-edit').getAttribute('aria-pressed'),'true');
go(admin,'/admin#/category/'+second.id);assert.equal(admin.document.querySelector('#section-edit').getAttribute('aria-pressed'),'true','edit mode survives category transition until Done');checks.push('listing mode persistence');
go(admin,'/admin#/category/'+first.id);const card=admin.document.querySelector('#main [data-project-card]');assert(card);const id=card.dataset.projectCard;const oldHref=card.getAttribute('href');admin.auditRefresh();const next=admin.document.querySelector('#main [data-project-card="'+id+'"]');assert(next===card,'unchanged admin card node is reused');checks.push('stable card identity');
go(admin,'/');const logo=admin.document.querySelector('.header .logo').getAttribute('href');assert.equal(logo,'/#/','public logo must not return to management');checks.push('public logo context');
// Public footer visibility depends on page class.
const footerStates=[];for(const path of ['/','/#/category/technical','/#/project/'+projects[0].slug,'/#/about']){go(admin,path);footerStates.push({path,display:admin.getComputedStyle(admin.document.querySelector('footer')).display})}assert(footerStates.every(x=>x.display==='flex'),'same existing footer is visible on every public page');checks.push('public footer consistency');
// Share links generated in the administrative context must not inherit /admin as a URL base.
go(admin,'/admin#/project/'+projects[0].slug);const share=admin.document.querySelector('#project-share');if(!share)throw Error('Share diagnostic: '+admin.location.pathname+admin.location.hash+'; flag='+admin.A45Management+'; main='+admin.document.querySelector('#main').textContent.slice(0,160)+'; count='+admin.archiveData.projects.length+'; state='+JSON.stringify(admin.auditState())+'; errors='+admin.auditErrors.slice(-2).join(' | '));const publishedUrl=new URL(share.href).searchParams.get('url');assert.equal(new URL(publishedUrl).pathname,'/share/'+projects[0].slug+'.html','admin sharing uses public route');checks.push('public share route');
await admin.happyDOM.close();
// A category omitted by the next public response must not survive from the old/seeded catalog.
const ghost=await boot('/#/category/camera-equipment',false);ghost.auditRefresh(cats.filter(c=>c.id!=='camera-equipment'));
assert.equal(ghost.A45Navigation.categories().some(c=>c.id==='camera-equipment'),false,'unreadable category absent from navigation');assert.equal(ghost.document.querySelector('#archive [data-category="camera-equipment"]')===null,true);checks.push('current readable catalog');
await ghost.happyDOM.close();
// Fresh page loads: one Window at a time to bound memory.
for(const mode of ['visitor','public-admin','admin'])for(const path of paths.filter(p=>!p.includes('/about'))){const adminMode=mode==='admin';const target=adminMode?'/admin'+path.slice(1):path;const w=await boot(target,mode!=='visitor');if(adminMode){assert(w.document.querySelector('#section-edit'));assert(w.document.querySelector('footer #management-navigation'))}else assert.equal(w.document.querySelector(tools)===null,true);direct++;await w.happyDOM.close()}
checks.push({roots:cats.filter(c=>c.parent_id===null).length,subcategories:cats.filter(c=>c.parent_id!==null).length,publishedProjects:projects.length,transitionChecks:transition,freshLoadChecks:direct,states:['visitor','public-admin','admin']});

console.log('PASS: matrix exercised '+transition+' in-app transitions and '+direct+' fresh loads across '+cats.length+' categories and '+projects.length+' published projects; '+findings.length+' unexpected conflicts recorded. No app source changed, no production writes.');
