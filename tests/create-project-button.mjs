import * as accessRoutes from '../src/access-routes.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {createProjectEditor} from '../src/project-editor.mjs';
const source=await Promise.all(['index.html','data/projects.js','project-page.js','app.js'].map(f=>readFile(new URL('../'+f,import.meta.url),'utf8')));
let admin=false;
async function until(test){for(let i=0;i<150;i++){if(test())return;await new Promise(r=>setTimeout(r,5))}assert.fail('Timed out')}
async function boot(url){
 const window=new Window({url});window.A45Management=admin;window.A45Routes=accessRoutes;
 for(const key of ['window','document','location','history','Event','CustomEvent'])globalThis[key]=key==='window'?window:window[key];
 Object.defineProperty(document,'scrollingElement',{value:document.documentElement});window.confirm=()=>true;
 document.write(source[0].replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,''));window.eval(source[1]);
 const categoryService={async isAdmin(){return admin},async listAdmin(){return window.archiveData.categories.map(c=>({...c,parent_id:c.parentId}))},coverUrl(){return ''}};
 const projectEditor=createProjectEditor({service:{},categoryService,refresh:async()=>{}});
 window.A45Cloud={projectEditor,releaseImage(){},start(){projectEditor.start()}};
 window.eval(source.slice(2).join('\n;\n'));
 const navigate=path=>{history.pushState(null,'',path);window.dispatchEvent(new Event('hashchange'))};
 return {window,projectEditor,navigate};
}
let app=await boot('http://127.0.0.1:3001/#/category/technical');
assert(!document.querySelector('#section-add'),'public visitors do not see creation actions');
assert(!document.querySelector('[data-create-project]'),'obsolete direct editor link is absent');
await app.window.happyDOM.close();admin=true;app=await boot('http://127.0.0.1:3001/admin#/category/technical');
for(const cat of window.archiveData.categories){
 window.A45Management=true;app.navigate('/admin#/category/'+cat.id);
 const button=document.querySelector('#section-add');
 assert.equal(button.dataset.parentCategory,cat.id);
 assert.equal(button.dataset.createKind,cat.parentId===null?'subcategory':'project');
 assert(!document.querySelector('[data-create-project]'));
 // Existing editor deep links retain their exact category context for later editing.
 app.navigate('/admin#/project/new?'+new URLSearchParams({category:cat.id}));
 await until(()=>!!document.querySelector('#project-edit-form'));
 assert.equal(app.projectEditor.doc.primaryCategoryId,cat.id);assert.deepEqual(app.projectEditor.doc.categoryIds,[cat.id]);
}
await app.window.happyDOM.close();console.log('PASS: shared contextual add button replaces legacy creation link; existing editor deep links preserve every category ID.');
