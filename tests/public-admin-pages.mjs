import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import * as ui from '../src/ui/components.mjs';
import * as routes from '../src/access-routes.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
const scripts=['data/projects.js','project-page.js','home-page.js','app.js'].map(f=>readFileSync(new URL('../'+f,import.meta.url),'utf8')).join('\n;\n');
function boot(url,authorized=false){
 const w=new Window({url,settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
 w.A45UI=ui;w.A45Routes=routes;w.A45Management=authorized;w.document.write(html);
 w.A45Feedback={clearWithin(){}};w.editorMounts=0;w.draftCalls=0;w.managedCalls=0;
 w.A45Cloud={projectEditor:{beforeRouteChange:()=>true,mount(){w.editorMounts++;w.document.querySelector('#main').innerHTML='<form id="project-edit-form"></form>'}},releaseImage(){},start(){},
  authorizeManagement(){if(authorized){w.A45Management=true;w.dispatchEvent(new w.Event('hashchange'))}else{w.history.replaceState(null,'','/login');w.dispatchEvent(new w.Event('hashchange'))}},
  async loadManagedProject(id){w.managedCalls++;return {...w.archiveData.projects.find(p=>p.id==='automatic-greenhouse'),id,slug:id,title:'Private server draft',status:'draft',editorPreview:true}},
  listDraftProjects(){w.draftCalls++;return w.draftRequest||Promise.resolve([])},
  mountLogin(){w.document.querySelector('#main').innerHTML='<form id="admin-login-form"></form>'}};
 w.eval(scripts);return w;
}
function go(w,path){w.history.replaceState(null,'',path);w.dispatchEvent(new w.Event('hashchange'))}
const tools='#home-edit,#home-add,#section-edit,#section-add,[data-nav-add],.card-edit-outline,#home-section-dialog,#project-edit-form';
function publicOnly(w){assert.equal(w.A45Management,false);assert.equal(w.document.querySelector(tools)===null,true,'no management DOM, including hidden nodes');assert.equal(w.document.querySelector('#navigation').textContent.trim(),'');assert.equal(w.document.querySelector('footer .footer-about a').textContent,'Обо мне');assert.equal(w.document.querySelector('#navigation').hidden,true)}
for(const page of ['','#/category/eco','#/project/automatic-greenhouse']){
 const w=boot('https://example.org/'+page,true);
 publicOnly(w);w.A45Home.open(null);assert.equal(w.document.querySelector('#home-section-dialog')===null,true,'public modal creation is blocked');
 await w.happyDOM.close();
}
const admin=boot('https://example.org/admin',true);
assert(admin.document.querySelector('#home-edit'));
assert.equal(admin.document.querySelector('.logo').getAttribute('href'),'/admin#/');
go(admin,'/admin#/category/eco');assert(admin.document.querySelector('#section-edit'));assert(admin.document.querySelector('[data-nav-add]'));
const card=admin.document.querySelector('[data-project-card]');assert(card);assert(card.getAttribute('href').startsWith('/admin#/project/'),'card URL works in a new tab too');
go(admin,'/admin#/project/automatic-greenhouse');
admin.document.querySelector('[data-edit-project]').click();assert.equal(admin.location.pathname,'/admin');assert(admin.location.hash.startsWith('#/project/edit/'));assert.equal(admin.editorMounts,1);
// Return to the exact same project must rerender management controls, not just its tab.
go(admin,'/admin#/project/automatic-greenhouse');go(admin,'/#/project/automatic-greenhouse');publicOnly(admin);
// Clear private snapshots and modal DOM as soon as public view is entered.
admin.archiveData.projects.push({id:'private',slug:'private',title:'Secret draft',categoryIds:['eco'],status:'draft',editorPreview:true});
admin.document.body.insertAdjacentHTML('beforeend','<dialog id="home-section-dialog"></dialog>');
go(admin,'/');publicOnly(admin);assert.equal(admin.archiveData.projects.some(p=>p.id==='private'),false);assert.equal(admin.document.querySelector('#archive').childElementCount,0);
go(admin,'/admin#/category/eco');assert(admin.document.querySelector('[data-nav-add]'),'management tree is rebuilt');
go(admin,'/admin#/project/server-draft');await new Promise(resolve=>setTimeout(resolve,0));assert.equal(admin.managedCalls,1);assert(admin.document.querySelector('#main').textContent.includes('Private server draft'),'a draft deep link loads only after admin authorization');go(admin,'/');publicOnly(admin);assert.equal(admin.archiveData.projects.some(p=>p.id==='server-draft'),false);go(admin,'/admin#/category/eco');
let resolveDrafts;admin.draftRequest=new Promise(resolve=>{resolveDrafts=resolve});go(admin,'/admin#/drafts');await Promise.resolve();go(admin,'/');
resolveDrafts([{id:'late-private',slug:'late-private',title:'Late secret',categoryIds:['eco'],status:'draft',editorPreview:true}]);
await new Promise(resolve=>setTimeout(resolve,0));assert.equal(admin.archiveData.projects.some(p=>p.id==='late-private'),false,'late draft fetch cannot repopulate public state');publicOnly(admin);await admin.happyDOM.close();
for(const path of ['/admin','/project/new?category=eco','/#/drafts','/transfer']){
 const denied=boot('https://example.org'+path,false);assert.equal(denied.location.pathname,'/login');assert(denied.document.querySelector('#admin-login-form'));assert.equal(denied.editorMounts,0);assert.equal(denied.draftCalls,0);assert.equal(denied.document.querySelector(tools)===null,true);await denied.happyDOM.close();
}
const hosting=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
assert(hosting.rewrites.some(rule=>rule.source==='/admin'&&rule.destination==='/index.html'));assert(!hosting.redirects.some(rule=>rule.source==='/admin'));
console.log('PASS: public/admin share views; public has no management DOM; protected editor and legacy links; management card links; private cache and late fetch cleanup; anonymous routes never mount editor/drafts.');
