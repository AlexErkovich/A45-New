import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createCategoryService} from '../src/category-service.mjs';
import {createProjectEditor} from '../src/project-editor.mjs';
import {redirectToLogin,returnFromLogin,sessionTransition} from '../src/session-navigation.mjs';
const win=new Window({url:'https://example.org/admin#/project/new?category=technical'});
for(const key of ['window','document','location','history','Event'])globalThis[key]=key==='window'?win:win[key];
win.archiveData={categories:[{id:'technical',parentId:null,title:'Проекты'}],projects:[]};
document.body.innerHTML='<main id="main"></main>';
const editor=createProjectEditor({service:{},categoryService:{async isAdmin(){return true}},visual:{state:{authorized:true}}});
await editor.mount();const title=document.querySelector('[name=title]');title.value='Несохранённый проект';title.dispatchEvent(new Event('input',{bubbles:true}));const doc=editor.doc;doc.revision=1; // A partial save can register a new project before its session expires.
let transitions=0;win.addEventListener('hashchange',()=>{assert.equal(sessionTransition,true);assert.equal(editor.beforeRouteChange(),true);transitions++});
redirectToLogin();assert.equal(location.pathname,'/login');assert.equal(editor.doc,doc);assert.equal(doc.title,'Несохранённый проект');
const target=new URLSearchParams(location.search).get('return');redirectToLogin();assert.equal(transitions,1,'login redirects cannot loop');returnFromLogin(target);assert.equal(location.pathname,'/admin');assert.equal(location.hash,'#/project/new?category=technical');await editor.mount();assert.equal(editor.doc,doc);assert.equal(document.querySelector('[name=title]').value,'Несохранённый проект');
history.replaceState(null,'','/#/category/technical');document.body.insertAdjacentHTML('beforeend','<dialog id="home-section-dialog"><input name="title" value="Новый подраздел"><input type="file"></dialog>');const modal=document.querySelector('#home-section-dialog');modal.showModal();redirectToLogin();assert.equal(modal.open,false);returnFromLogin('/#/category/technical');assert.equal(modal.open,true);assert.equal(modal.querySelector('input').value,'Новый подраздел');modal.close();
for(const unsafe of ['https://evil.example','//evil.example','/#/login','/login']){returnFromLogin(unsafe);assert.equal(location.pathname,'/admin');assert.equal(location.hash,'')}
let expired=0,user=null,error=null,admin=true;
const service=createCategoryService({storage:{from(){return {}}},auth:{async getUser(){return {data:{user},error}}},async rpc(){return {data:admin}}},{onSessionExpired(){expired++}});
assert.equal(await service.isAdmin(),false);assert.equal(expired,0);assert.equal(await service.isAdmin(true),false);assert.equal(expired,1);user={id:'u'};assert.equal(await service.isAdmin(),true);admin=false;assert.equal(await service.isAdmin(),false);assert.equal(expired,1,'a signed-in non-admin is not a session expiry');error={status:503};assert.equal(await service.isAdmin(),false);assert.equal(expired,1,'network failure does not force a login');error={status:401};await service.isAdmin();assert.equal(expired,2);
await win.happyDOM.close();console.log('PASS: expired sessions redirect without loops, safe return URLs, editor drafts and modal inputs survive login; network and role errors remain distinct.');
