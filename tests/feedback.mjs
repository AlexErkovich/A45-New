import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const win=new Window({url:'http://localhost/'});
win.document.body.innerHTML='<form><input name="title" required><button type="submit">Сохранить</button><p data-admin-status role="status"></p></form>';
win.eval(readFileSync(new URL('../icons.js',import.meta.url),'utf8'));
win.eval(readFileSync(new URL('../feedback.js',import.meta.url),'utf8'));
const api=win.A45Feedback,field=win.document.querySelector('input');
const current=()=>win.document.querySelector('.feedback-popover:not(.feedback-leaving)');
api.show(field,{tone:'error',message:'Введите название.'});
assert.equal(field.getAttribute('aria-invalid'),'true');
assert.equal(current().querySelectorAll('svg').length,2);
assert.ok(field.getAttribute('aria-describedby').includes(current().id));
assert.equal(current().parentElement,win.document.body);
current().querySelector('.feedback-close').click();
assert.equal(current(),null);assert.equal(field.getAttribute('aria-invalid'),'true');
field.dispatchEvent(new win.FocusEvent('focusin',{bubbles:true}));assert.ok(current());
field.value='Название';field.dispatchEvent(new win.Event('input',{bubbles:true}));assert.equal(field.hasAttribute('aria-invalid'),false);assert.equal(current(),null);
let saved=0,discarded=0;
api.show(field,{tone:'warning',message:'Не сохранено.',actions:[{label:'Сохранить',id:'save',run:()=>saved++},{label:'Не сохранять',id:'discard',run:()=>discarded++}]});
assert.equal(current().getAttribute('role'),'dialog');current().querySelector('[data-feedback-action=save]').click();assert.equal(saved,1);assert.equal(discarded,0);
api.show(field,{tone:'warning',message:'Не сохранено.',actions:[{label:'Не сохранять',id:'discard',run:()=>discarded++}]});
current().querySelector('[data-feedback-action=discard]').click();assert.equal(discarded,1);
const source=win.document.querySelector('[data-admin-status]');source.className='error';source.textContent='Не удалось сохранить название.';
await win.happyDOM.whenAsyncComplete();
assert.equal(source.hasAttribute('data-feedback-source'),true);assert.ok(current().textContent.includes('Не удалось сохранить'));assert.equal(field.dataset.feedbackTone,'error');
api.clearWithin(win.document.querySelector('form'));assert.equal(field.hasAttribute('data-feedback-tone'),false);
const dialog=win.document.createElement('dialog');win.document.body.append(dialog);dialog.innerHTML='<input required>';dialog.showModal();const modalField=dialog.querySelector('input');api.show(modalField,{tone:'error',message:'Заполните поле.'});assert.equal(current().parentElement,dialog);
win.document.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(current(),null);assert.equal(dialog.open,true);
// Arrow stays aimed at the field when the bubble flips and clamps.
Object.defineProperty(win,'innerWidth',{value:800,configurable:true});Object.defineProperty(win,'innerHeight',{value:600,configurable:true});
for(const [rect,side] of [
 [{left:100,right:200,top:100,bottom:140,width:100,height:40},'right'],
 [{left:650,right:750,top:100,bottom:140,width:100,height:40},'left'],
 [{left:100,right:700,top:100,bottom:140,width:600,height:40},'bottom'],
 [{left:100,right:700,top:550,bottom:590,width:600,height:40},'top']
]){
 field.getBoundingClientRect=()=>rect;
 const bubble=api.show(field,{message:'Проверка '+side});bubble.getBoundingClientRect=()=>({width:200,height:100});api.reposition();await new Promise(resolve=>win.setTimeout(resolve,25));
 assert.equal(bubble.dataset.side,side);assert(Number.parseFloat(bubble.style.left)>=14);assert(Number.parseFloat(bubble.style.top)>=14);
 assert(bubble.style.getPropertyValue('--feedback-arrow-x'));assert(bubble.style.getPropertyValue('--feedback-arrow-y'));api.dismiss();
}
const cancelled=api.confirm(field,{message:'Удалить?',confirmLabel:'Удалить',danger:true});current().querySelector('.feedback-close').click();assert.equal(await cancelled,false);
const confirmed=api.confirm(field,{message:'Удалить?',confirmLabel:'Удалить',danger:true});current().querySelector('[data-feedback-action=confirm]').click();assert.equal(await confirmed,true);
await win.happyDOM.close();
console.log('PASS: shared anchored feedback, status/ARIA, dismiss without losing validation, correction, save/discard, migrated admin errors, modal host and Escape.');
