import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {createVisualEditor} from '../src/visual-editor.mjs';
import {createProjectEditor} from '../src/project-editor.mjs';
const source=await Promise.all(['index.html','data/projects.js','project-page.js','app.js'].map(f=>readFile(new URL('../'+f,import.meta.url),'utf8')));
let admin=false;
async function until(test){for(let i=0;i<150;i++){if(test())return;await new Promise(r=>setTimeout(r,5))}assert.fail('Timed out')}
async function boot(url){
 const window=new Window({url});
 for(const key of ['window','document','location','history','Event','CustomEvent'])globalThis[key]=key==='window'?window:window[key];
 Object.defineProperty(document,'scrollingElement',{value:document.documentElement});window.confirm=()=>true;
 document.write(source[0].replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,''));window.eval(source[1]);
 const categoryService={async isAdmin(){return admin},async listAdmin(){return window.archiveData.categories.map(c=>({...c,parent_id:c.parentId}))},coverUrl(){return ''}};
 const visual=createVisualEditor({client:{auth:{async signOut(){admin=false;return {}}}},service:categoryService,refresh:async()=>{}});
 const projectEditor=createProjectEditor({service:{},categoryService,visual,refresh:async()=>{}});
 window.A45Cloud={visual,projectEditor,releaseImage(){},start(){projectEditor.start();visual.start()}};
 window.eval(source.slice(2).join('\n;\n'));
 const navigate=path=>{history.pushState(null,'',path);window.dispatchEvent(new Event('hashchange'))};
 return {window,visual,projectEditor,navigate};
}
let app=await boot('http://127.0.0.1:3001/#/category/technical');
assert(!document.querySelector('[data-create-project]'),'visitor');
admin=true;await app.visual.checkAuth();assert(!document.querySelector('[data-create-project]'),'admin outside edit mode');
document.querySelector('[data-visual="enter"]').click();await until(()=>document.querySelector('[data-create-project]'));
for(const cat of window.archiveData.categories){
 app.navigate('/#/category/'+cat.id);const button=document.querySelector('[data-create-project]');
 assert(button,cat.id);assert.equal(document.querySelectorAll('[data-create-project]').length,1);
 assert.equal(button.previousElementSibling.tagName,'H1');assert.equal(button.nextElementSibling.id,'open-filter');
 const href=new URL(button.href);assert.equal(href.pathname,'/project/new');assert.equal(href.searchParams.get('category'),cat.id);
 button.click();await until(()=>!!document.querySelector('#project-edit-form'));assert.equal(app.projectEditor.doc.primaryCategoryId,cat.id);assert.deepEqual(app.projectEditor.doc.categoryIds,[cat.id]);
}
app.navigate('/#/category/0/'+encodeURIComponent('Макросъёмка'));
assert.equal(new URL(document.querySelector('[data-create-project]').href).searchParams.get('category'),'macro');
app.visual.editor.preview();assert(!document.querySelector('[data-create-project]'));app.visual.editor.preview();assert(document.querySelector('[data-create-project]'));
app.visual.editor.exit();assert(!document.querySelector('[data-create-project]'));
// Simulate a refreshed deep page: verified Auth alone never enables editing automatically.
await app.window.happyDOM.close();app=await boot('http://127.0.0.1:3001/#/category/beetles');await until(()=>app.visual.state.authorized);
assert(!document.querySelector('[data-create-project]'));document.querySelector('[data-visual="enter"]').click();await until(()=>document.querySelector('[data-create-project]'));
assert.equal(new URL(document.querySelector('[data-create-project]').href).searchParams.get('category'),'beetles');
app.visual.editor.authorize(false);assert(!document.querySelector('[data-create-project]'),'immediate removal on lost role');
await app.window.happyDOM.close();console.log('PASS: actual app + editor state, all 45 categories, exact subsection ID, button order/visibility, click into existing editor, legacy links, refreshed deep page, preview/exit/auth loss. Auth is mocked; no cloud writes.');
