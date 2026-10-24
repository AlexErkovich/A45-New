import {dialogHeader} from './components.mjs';
import {escape as e} from '../project-model.mjs';
export function openProjectPhotoPicker({root=document.body,doc,urls,onSelect}){
 const ids=[...new Set(doc.tabs.filter(t=>t.kind==='photos'||/фотограф|photos/i.test(t.title)).flatMap(t=>t.blocks.flatMap(b=>b.type==='IMAGE'?[b.content.mediaId]:b.type==='GALLERY'?(b.content.items||[]).map(i=>i.mediaId):[])))].filter(id=>doc.media.some(m=>m.id===id));
 const dialog=document.createElement('dialog');dialog.className='canvas-modal project-photo-picker';dialog.setAttribute('aria-label','Фотографии проекта');
 dialog.innerHTML=`${dialogHeader('Из вкладки «Фотографии»',{closeAttributes:'data-picker-close',closeLabel:'Закрыть выбор фотографий'})}${ids.length?`<form><div class="photo-picker-grid">${ids.map(id=>{const media=doc.media.find(m=>m.id===id);return `<label><input type="checkbox" name="photo" value="${e(id)}"><img src="${e(urls[id]||'')}" alt="${e(media.alt||media.name||'Фотография')}"><span>${e(media.alt||media.name||'Фотография')}</span></label>`}).join('')}</div><div class="photo-picker-actions"><button type="button" data-picker-close>Отмена</button><button type="submit" class="canvas-save" disabled>Добавить</button></div></form>`:'<p>Сначала добавьте фотографии во вкладку «Фотографии» этого проекта.</p>'}`;
 root.append(dialog);dialog.querySelectorAll('[data-picker-close]').forEach(button=>button.onclick=()=>dialog.close());
 const form=dialog.querySelector('form');if(form){form.onchange=()=>{form.querySelector('[type=submit]').disabled=!form.querySelector('input:checked')};form.onsubmit=event=>{event.preventDefault();const selected=[...form.querySelectorAll('input:checked')].map(input=>input.value);if(!selected.length)return;dialog.close();onSelect(selected)}}
 dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();return dialog;
}
