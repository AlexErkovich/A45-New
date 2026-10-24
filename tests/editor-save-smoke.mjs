// One tiny text-only project. No Worker, files, database, network, or browser process.
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createProjectEditor} from '../src/project-editor.mjs';
const w=new Window({url:'https://example.test/admin#/project/new?category=eco',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
for(const key of ['window','document','location','history','Event'])globalThis[key]=key==='window'?w:w[key];
w.archiveData={projects:[],categories:[{id:'eco',title:'Эко',parentId:null}]};w.document.body.innerHTML='<main id="main"></main>';
let saves=0,fail=true;
const editor=createProjectEditor({categoryService:{async isAdmin(){return true}},service:{async save(doc,pending,status){saves++;if(fail)throw Error('Mock offline');doc.status=status;doc.revision++;doc.slug='test-project'}},recovery:{available:false,async remove(){}}});
await editor.mount();assert.equal(editor.doc.primaryCategoryId,'eco');assert.equal(w.document.querySelector('.project-close').getAttribute('href'),'/admin#/category/eco');
const title=w.document.querySelector('[name=title]');title.value='Text-only draft';title.dispatchEvent(new w.Event('input',{bubbles:true}));
async function submit(){w.document.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));for(let i=0;i<12;i++)await Promise.resolve()}
await submit();assert.equal(saves,1);assert.equal(editor.dirty,true);assert(w.document.querySelector('[data-project-status]').textContent.includes('Mock offline'));
fail=false;await submit();assert.equal(saves,2);assert.equal(editor.dirty,false);assert.equal(w.location.pathname,'/admin');assert.equal(w.location.hash,'#/project/test-project?category=eco');assert.equal(editor.doc.status,'draft','saved document remains a draft');assert.equal(w.archiveData.projects[0].editorPreview,true);
w.history.replaceState(null,'','/');w.document.querySelector('main').textContent='Public view';await editor.mount();assert.equal(w.document.querySelector('main').textContent,'Public view','direct editor mount cannot change public DOM');
await w.happyDOM.close();console.log('PASS: existing editor retains category/close link, text draft, failed-save retention and retry; Save returns inside admin; public direct mount is inert. No uploads/network/database.');
