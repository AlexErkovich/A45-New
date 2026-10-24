import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {newProject,newTab,uid} from '../src/project-model.mjs';
import {hydrateCanvas,serializeCanvas} from '../src/canvas-model.mjs';
import {editorView} from '../src/project-editor-view.mjs';
import {tabKind} from '../src/ui/tab-kind.mjs';
import {bindDropzones} from '../src/ui/components.mjs';
for(const title of ['Фото','Фотографии','Фото и видео','Photos','Project photos']){
 for(const existing of [false,true]){
  const source=newProject('technical');source.title=existing?'Шлем для съёмки от первого лица':'Новый проект';source.tabs=[newTab(title,true)];
  source.tabs[0].blocks=[{id:uid(),type:'IMAGE',content:{mediaId:'photo-1'}}];source.media=[{id:'photo-1',kind:'image',name:'attached.jpg'}];
  const doc=hydrateCanvas(source);assert.equal(tabKind(doc.tabs[0]),'photos');
  const win=new Window();win.document.body.innerHTML='<header>Outside drop zone</header>'+editorView({doc,currentTab:0,busy:false,localUrls:{'photo-1':'https://example.com/attached.jpg'}});
  bindDropzones(win.document.body);
  assert.equal(win.document.querySelectorAll('[data-tab-drop]').length,1,title);
  assert.ok(win.document.querySelector('[data-upload="tab"][type=file]'));assert.ok(win.document.querySelector('[data-open-photo="photo-1"]'));
  const events=[];win.document.body.addEventListener('ui-files',e=>events.push(e));
  const event=new win.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(event,'dataTransfer',{value:{types:['Files'],files:[new win.File(['photo'],'photo.jpg',{type:'image/jpeg'})]}});win.document.querySelector('header').dispatchEvent(event);
  assert.equal(events.length,1,title+' whole-page drop routes once');assert.equal(events[0].target.dataset.upload,'tab');
  const roundTrip=hydrateCanvas(serializeCanvas(doc));assert.equal(tabKind(roundTrip.tabs[0]),'photos');roundTrip.tabs[0].title='Переименованная вкладка';assert.equal(tabKind(hydrateCanvas(serializeCanvas(roundTrip)).tabs[0]),'photos');
  win.happyDOM.abort();
 }
}
console.log('PASS: every photo tab alias in existing/new projects has one shared dropzone, attached files, whole-page drop and persisted kind after rename.');
