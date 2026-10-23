'use strict';
// Shared anchored feedback. Popovers are outside document flow and above modal dialogs.
window.A45Feedback=(()=>{
 const records=new Map();
 let active=null,serial=0,frame=0,restoringFocus=false;
 const icon=name=>window.A45Icons?.[name]||'';
 function unlink(record){const ids=(record.anchor.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==record.node.id);if(ids.length)record.anchor.setAttribute('aria-describedby',ids.join(' '));else record.anchor.removeAttribute('aria-describedby')}
 function dismiss({restoreFocus=false}={}){if(!active)return;const record=active;active=null;unlink(record);record.node.classList.add('feedback-leaving');if(restoreFocus&&record.anchor.isConnected){restoringFocus=true;record.anchor.focus({preventScroll:true});restoringFocus=false}setTimeout(()=>{try{record.node.hidePopover?.()}catch{}record.node.remove()},160)}
 function clear(anchor){if(!anchor)return;records.delete(anchor);anchor.removeAttribute('data-feedback-tone');anchor.removeAttribute('aria-invalid');if(active?.anchor===anchor)dismiss()}
 function clearWithin(root){for(const anchor of records.keys())if(anchor===root||root.contains(anchor))clear(anchor)}
 function mark(anchor,options){if(!anchor)return;records.set(anchor,{...options});anchor.dataset.feedbackTone=options.tone||'error';if((options.tone||'error')==='error')anchor.setAttribute('aria-invalid','true');else anchor.removeAttribute('aria-invalid')}
 function position(){
  frame=0;if(!active)return;const {anchor,node}=active;
  if(!anchor.isConnected||anchor.closest('dialog:not([open])')){dismiss();return}
  const rect=anchor.getBoundingClientRect(),view=window.visualViewport,vx=view?.offsetLeft||0,vy=view?.offsetTop||0,vw=view?.width||innerWidth,vh=view?.height||innerHeight,margin=14,gap=14;
  node.style.maxWidth=Math.min(320,vw-margin*2)+'px';node.style.maxHeight=vh-margin*2+'px';
  const box=node.getBoundingClientRect();let left,top,side;
  if(vx+vw-rect.right>=box.width+gap+margin){left=rect.right+gap;top=rect.top+(rect.height-box.height)/2;side='right'}
  else if(rect.left-vx>=box.width+gap+margin){left=rect.left-box.width-gap;top=rect.top+(rect.height-box.height)/2;side='left'}
  else if(vy+vh-rect.bottom>=box.height+gap+margin){left=rect.left+(rect.width-box.width)/2;top=rect.bottom+gap;side='bottom'}
  else{left=rect.left+(rect.width-box.width)/2;top=rect.top-box.height-gap;side='top'}
  left=Math.max(vx+margin,Math.min(left,vx+vw-box.width-margin));top=Math.max(vy+margin,Math.min(top,vy+vh-box.height-margin));
  const clamp=(n,min,max)=>Math.max(min,Math.min(n,Math.max(min,max)));
  node.style.left=left+'px';node.style.top=top+'px';node.dataset.side=side;
  node.style.setProperty('--feedback-arrow-x',clamp(rect.left+rect.width/2-left,18,box.width-18)+'px');
  node.style.setProperty('--feedback-arrow-y',clamp(rect.top+rect.height/2-top,18,box.height-18)+'px');
 }

 function schedule(){if(active&&!frame)frame=requestAnimationFrame(position)}
 function show(anchor,options={}){if(!anchor)return;const config={tone:'error',...options};if(active?.anchor===anchor&&active.config.message===config.message&&active.config.tone===config.tone&&active.config.title===config.title&&!config.actions?.length)return active.node;mark(anchor,config);dismiss();const node=document.createElement('div');node.id='feedback-'+(++serial);node.className='feedback-popover';node.dataset.tone=config.tone;node.setAttribute('popover','manual');node.setAttribute('role',config.actions?.length?'dialog':'tooltip');node.setAttribute('aria-label',config.title||'Подсказка');
 const content=document.createElement('div');content.className='feedback-content';node.append(content);const heading=document.createElement('div');heading.className='feedback-heading';const symbol=document.createElement('span');symbol.className='feedback-symbol';symbol.innerHTML=icon(config.tone==='error'?'alertCircle':config.tone==='warning'?'triangleAlert':config.tone==='success'?'checkCircle':'info');const title=document.createElement('strong');title.textContent=config.title||({error:'Нужно исправить',warning:'Есть несохранённые изменения',success:'Готово',info:'Обратите внимание'}[config.tone]);const close=document.createElement('button');close.type='button';close.className='feedback-close ui-action-icon';close.setAttribute('aria-label','Закрыть подсказку');close.innerHTML=icon('x');close.addEventListener('click',()=>dismiss({restoreFocus:true}));heading.append(symbol,title,close);const message=document.createElement('p');message.textContent=config.message;message.setAttribute('aria-live','polite');content.append(heading,message);
 if(config.actions?.length){const actions=document.createElement('div');actions.className='feedback-actions';for(const action of config.actions){const button=document.createElement('button');button.type='button';button.textContent=action.label;button.dataset.feedbackAction=action.id||'';button.className=action.danger?'feedback-danger':action.primary?'feedback-primary':'';button.disabled=!!action.disabled;button.addEventListener('click',()=>{dismiss();action.run?.()});actions.append(button)}content.append(actions)}
 (anchor.closest('dialog[open]')||document.body).append(node);active={anchor,node,config};const ids=new Set((anchor.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));ids.add(node.id);anchor.setAttribute('aria-describedby',[...ids].join(' '));try{node.showPopover?.()}catch{}position();if(config.focusActions)node.querySelector('.feedback-actions button:not(:disabled)')?.focus({preventScroll:true});return node;
 }
 document.addEventListener('focusin',e=>{const config=records.get(e.target);if(!restoringFocus&&config&&active?.anchor!==e.target&&!config.actions?.length)show(e.target,config)});
 document.addEventListener('pointerover',e=>{const config=records.get(e.target);if(!restoringFocus&&config&&active?.anchor!==e.target&&!config.actions?.length)show(e.target,config)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){e.preventDefault();e.stopImmediatePropagation();dismiss({restoreFocus:true})}},true);
 document.addEventListener('invalid',e=>{if(!(e.target instanceof HTMLElement))return;e.preventDefault();const field=e.target;const message=field.validity.valueMissing?'Заполните это поле.':field.validity.typeMismatch?'Проверьте формат значения.':field.validationMessage;mark(field,{tone:'error',message});if(!active)show(field,{tone:'error',message})},true);
 document.addEventListener('input',e=>{if(records.has(e.target)&&e.target.matches('input,textarea,select')&&e.target.validity.valid&&e.target.value.trim())clear(e.target)});
 document.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
 const selectors='[data-admin-status],[data-project-status],.visual-message,#visual-crop-status';
 const seen=new WeakMap(),lastActions=new WeakMap();
 const scopeOf=node=>node.closest('dialog,form,.project-editor,.admin-page')||document.body;
 for(const type of ['click','change'])document.addEventListener(type,e=>{const control=e.target.closest?.('button,input,textarea,select');if(control&&!control.closest('.feedback-popover')){lastActions.set(scopeOf(control),control);const form=control.closest('form');if(form)lastActions.set(form,control)}},true);
 function migrate(source){if(source.hasAttribute('data-feedback-inline'))return;source.setAttribute('data-feedback-source','');const message=source.textContent.trim(),signature=message+'|'+source.className;if(seen.get(source)===signature)return;seen.set(source,signature);if(!message){if(active?.source===source)dismiss();return}const root=scopeOf(source),tone=source.classList.contains('error')||/не удалось|ошибк|обязательн|заполните|выберите/i.test(message)?'error':/сохранен|сохранён|готово|успешно/i.test(message)?'success':'info';let anchor=lastActions.get(root);if(!anchor?.isConnected)anchor=root.querySelector('button[type=submit],button:not([disabled]),input:not([type=hidden])')||root;if(/названи/i.test(message))anchor=root.querySelector('[name=title]')||anchor;if(/описани/i.test(message))anchor=root.querySelector('[name=description]')||anchor;if(/обложк|изображени|файл|фото/i.test(message)&&!/удал|сохран|сесси|прав|browser/i.test(message))anchor=root.querySelector('[data-project-cover],[data-home-upload],input[type=file]')?.closest('label')||root.querySelector('[data-home-upload],input[type=file]')||anchor;show(anchor,{tone,message});if(active)active.source=source;
 }
 const observer=new MutationObserver(changes=>{const sources=new Set();for(const change of changes){if(change.target.nodeType===1&&change.target.closest('.feedback-popover'))continue;const parent=change.target.nodeType===1?change.target:change.target.parentElement;if(parent?.matches(selectors))sources.add(parent);const ancestor=parent?.closest(selectors);if(ancestor)sources.add(ancestor);for(const node of change.addedNodes||[])if(node.nodeType===1){if(node.matches(selectors))sources.add(node);node.querySelectorAll(selectors).forEach(source=>sources.add(source))}}sources.forEach(migrate);for(const anchor of records.keys())if(!anchor.isConnected)records.delete(anchor);if(active&&!active.anchor.isConnected)dismiss()});
 document.querySelectorAll(selectors).forEach(migrate);observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
 return {show,mark,clear,clearWithin,dismiss,reposition:schedule};
})();
