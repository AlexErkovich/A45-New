import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {uploadDropzone,photoDropzone,bindDropzones,setDropzoneState} from '../src/ui/components.mjs';
const win=new Window({url:'http://localhost/'}),doc=win.document;
doc.body.innerHTML='<header>Шапка</header><main>'+photoDropzone()+'</main><dialog>'+uploadDropzone({label:'Обложка',buttonLabel:'Загрузить',inputAttributes:'name="cover"'})+'</dialog>';
bindDropzones(doc.body);bindDropzones(doc.body);
const drops=[];doc.body.addEventListener('ui-files',e=>drops.push({input:e.target,files:e.detail.files}));
const file=new win.File(['image'],'photo.png',{type:'image/png'});
function drag(type,target=doc.querySelector('header'),files=[file]){const event=new win.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(event,'dataTransfer',{value:{types:['Files'],files,dropEffect:''}});target.dispatchEvent(event);return event}
drag('dragenter');assert(doc.body.classList.contains('ui-page-drag'));assert(doc.querySelector('.ui-page-drop-overlay'));
drag('dragenter',doc.querySelector('main'));drag('dragleave',doc.querySelector('main'));assert(doc.querySelector('.ui-page-drop-overlay'),'moving between elements does not flicker');
const event=drag('drop');assert(event.defaultPrevented);assert.equal(drops.length,1);assert.equal(drops[0].input.dataset.upload,'tab');assert.equal(doc.querySelector('.ui-page-drop-overlay'),null);
const modal=doc.querySelector('dialog');modal.showModal();drag('dragenter');assert.equal(doc.querySelector('.ui-page-drop-overlay').parentElement,modal,'whole-screen highlight stays above modal backdrop');drag('drop');assert.equal(drops.length,2);assert.equal(drops[1].input.name,'cover','outside drop belongs to the open dialog');modal.close();
const main=doc.querySelector('main');main.insertAdjacentHTML('beforeend',uploadDropzone({label:'Документ',inputAttributes:'data-upload="document"'}));drag('dragenter',main.lastElementChild);drag('drop',main.lastElementChild);assert.equal(drops.at(-1).input.dataset.upload,'document','explicit target wins over photos');
setDropzoneState(main.querySelector('[data-ui-dropzone]'),{busy:true,error:true});assert.equal(main.querySelector('[role=status]').hidden,false);setDropzoneState(main.querySelector('[data-ui-dropzone]'),{busy:false});assert(main.querySelector('[data-ui-dropzone]').classList.contains('is-error'),'updating progress preserves errors');
drag('dragenter');win.dispatchEvent(new win.Event('blur'));assert.equal(doc.querySelector('.ui-page-drop-overlay'),null);
let clicks=0;const picker=main.querySelector('input');picker.click=()=>clicks++;main.querySelector('[data-ui-pick]').click();assert.equal(clicks,1,'shared binding opens the picker exactly once');
await win.happyDOM.close();console.log('PASS: unified upload markup, one picker handler, whole-page drop, modal priority, direct targets, progress/error states and cleanup.');
