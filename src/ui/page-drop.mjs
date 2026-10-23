import {icons} from './icons.mjs';
export function installPageDrop(document){
 if(document.a45PageDrop)return;let depth=0,overlay=null;
 const view=document.defaultView;
 function clear(){depth=0;document.body.classList.remove('ui-page-drag');document.querySelectorAll('.ui-dropzone.is-drag-over').forEach(n=>n.classList.remove('is-drag-over'));overlay?.remove();overlay=null}
 function destination(target){const dialogs=[...document.querySelectorAll('dialog[open]')],scope=dialogs.at(-1)||document;
 const usable=zone=>{const input=zone?.querySelector('input[type=file]');return input&&!input.matches(':disabled')&&!zone.closest('[hidden],dialog:not([open])')&&zone.getAttribute('aria-busy')!=='true'};
 const direct=target?.closest?.('[data-ui-dropzone]');if(direct&&scope.contains(direct)&&usable(direct))return direct;
 const focused=document.activeElement?.closest?.('.canvas-block')?.querySelector('[data-ui-dropzone]');if(focused&&scope.contains(focused)&&usable(focused))return focused;
 const zones=[...scope.querySelectorAll('[data-ui-dropzone]')].filter(usable);return zones.find(z=>z.hasAttribute('data-tab-drop'))||zones[0]}
 const hasFiles=e=>Array.from(e.dataTransfer?.types||[]).includes('Files')||!!e.dataTransfer?.files?.length;
 function show(zone){document.body.classList.add('ui-page-drag');if(!overlay){overlay=document.createElement('div');overlay.className='ui-page-drop-overlay';overlay.setAttribute('aria-hidden','true');overlay.innerHTML=`${icons.folderUp}<strong>Отпустите файлы в любом месте страницы</strong><span></span>`}overlay.querySelector('span').textContent=zone.getAttribute('aria-label')||'Загрузка файлов';const parent=zone.closest('dialog[open]')||document.body;if(overlay.parentElement!==parent)parent.append(overlay);document.querySelectorAll('.ui-dropzone.is-drag-over').forEach(n=>n.classList.remove('is-drag-over'));zone.classList.add('is-drag-over')}
 document.addEventListener('dragenter',event=>{if(!hasFiles(event))return;const zone=destination(event.target);if(!zone)return;event.preventDefault();depth++;show(zone)},true);
 document.addEventListener('dragover',event=>{if(!hasFiles(event))return;const zone=destination(event.target);if(!zone){if(document.querySelector('[data-ui-dropzone]'))event.preventDefault();clear();return}event.preventDefault();event.dataTransfer.dropEffect='copy';show(zone)},true);
 document.addEventListener('dragleave',()=>{if(--depth<=0)clear()},true);
 document.addEventListener('drop',event=>{if(!hasFiles(event)){clear();return}const zone=destination(event.target);clear();if(!zone){if(document.querySelector('[data-ui-dropzone]'))event.preventDefault();return}event.preventDefault();event.stopImmediatePropagation();zone.querySelector('input[type=file]').dispatchEvent(new view.CustomEvent('ui-files',{bubbles:true,detail:{files:[...event.dataTransfer.files]}}))},true);
 document.addEventListener('dragend',clear,true);document.addEventListener('keydown',event=>{if(event.key==='Escape')clear()},true);view.addEventListener('blur',clear);view.addEventListener('hashchange',clear);view.addEventListener('popstate',clear);
 document.a45PageDrop={clear};
}
