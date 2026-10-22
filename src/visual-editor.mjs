import { createEditorState } from './editor-state.mjs';
import { cropRect,validateImage } from './category-service.mjs';
import { mountAuthForm } from './auth-form.mjs';
export function createVisualEditor({client,service,refresh}){
 let started=false,authCheck=0,actionAfterSave=null,cropGeneration=0,cropUrl=null,cropImage=null,cropId=null,lastRoute=location.pathname+location.search+location.hash,approvedRoute=null;
 const listeners=new Set();
 const editor=createEditorState(service,{changed:()=>{renderControls();decorateCards();for(const listener of listeners)listener()},revoke:url=>URL.revokeObjectURL(url)});
 const editable=()=>editor.state.authorized&&editor.state.editing&&!editor.state.preview&&!editor.state.saving;
 function controls(){let el=document.querySelector('#visual-controls');if(!el){el=document.createElement('div');el.id='visual-controls';document.body.append(el)}return el}
 function renderControls(){queueMicrotask(()=>window.dispatchEvent(new Event('a45-visual-state')));const s=editor.state;if(!started)return;const el=controls();if(!s.authorized&&!editor.dirty){el.hidden=true;return}el.hidden=false;
  el.className='visual-controls';el.setAttribute('aria-label','Управление редактированием');
  if(!s.editing&&!editor.dirty){el.remove();return}
  el.innerHTML=`<strong>A45</strong><span>${s.preview?'Предпросмотр':'Режим редактирования'}</span><span class="visual-dirty" aria-live="polite">${s.saving?'Сохранение…':editor.dirty?'Не сохранено: '+s.drafts.size:'Изменений нет'}</span>${!s.authorized?`<a href="/#/login?return=${encodeURIComponent(location.hash||'#/')}" data-visual-login>Войти снова</a>`:''}<button type="button" data-visual="preview" ${s.saving?'disabled':''}>${s.preview?'Редактировать':'Предпросмотр'}</button><button type="button" data-visual="save" ${!s.authorized||!editor.dirty||s.saving?'disabled':''}>Сохранить</button><button type="button" data-visual="finish" ${s.saving?'disabled':''}>Завершить</button><button type="button" data-visual="signout" ${s.saving?'disabled':''}>Выйти</button>${s.message?'<p class="visual-message" role="status"></p>':''}`;
  const message=el.querySelector('.visual-message');if(message){message.textContent=s.message;message.classList.toggle('error',s.error)}
 }
 function decorateCards(){if(!started)return;window.dispatchEvent(new Event('a45-visual-state'));document.body.classList.toggle('visual-editing',editable());
  document.querySelectorAll('[data-category-card]').forEach(card=>{const id=card.dataset.categoryCard,data=editor.effective(id);const title=card.querySelector('h2'),description=card.querySelector('.card-body p'),image=card.querySelector('img');
   for(const [node,field] of [[title,'title'],[description,'description']]){if(!node)continue;node.dataset.editField=field;if(editable()){node.setAttribute('contenteditable','plaintext-only');node.setAttribute('role','textbox');node.setAttribute('aria-label',field==='title'?'Название направления':'Описание направления')}else{node.removeAttribute('contenteditable');node.removeAttribute('role');node.removeAttribute('aria-label')}
    if(data&&document.activeElement!==node&&node.textContent!==data[field])node.textContent=data[field];}
   if(image){if(!card.dataset.originalImage)card.dataset.originalImage=image.getAttribute('src');const url=data?.imageUrl||(data?.cover_image_path?service.coverUrl(data.cover_image_path):card.dataset.originalImage);if(image.getAttribute('src')!==url)image.src=url;if(editable()){image.setAttribute('role','button');image.tabIndex=0;image.setAttribute('aria-label','Заменить обложку направления')}else{image.removeAttribute('role');image.removeAttribute('tabindex');image.removeAttribute('aria-label')}}
   card.classList.toggle('visual-card-dirty',editor.state.drafts.has(id)&&editor.state.editing&&!editor.state.preview);
  });
 }
 async function checkAuth(){if(!service)return;const generation=++authCheck;try{const authorized=await service.isAdmin();if(generation!==authCheck)return;editor.authorize(authorized)}catch{if(generation===authCheck)editor.authorize(false)}}
 function clearCrop(){cropGeneration++;if(cropUrl)URL.revokeObjectURL(cropUrl);cropUrl=null;cropImage=null;cropId=null}
 function ensureDialogs(){if(document.querySelector('#visual-unsaved'))return;
  const root=document.createElement('div');root.id='visual-dialogs';root.innerHTML=`<dialog id="visual-unsaved" class="visual-dialog" aria-labelledby="visual-unsaved-title"><h2 id="visual-unsaved-title">Есть несохранённые изменения</h2><p>Сохранить их перед завершением?</p><div class="visual-dialog-actions"><button type="button" data-visual="save-finish">Сохранить и продолжить</button><button type="button" data-visual="discard-finish">Отменить изменения</button><button type="button" data-visual="cancel-finish">Вернуться к редактированию</button></div></dialog><dialog id="visual-crop" class="visual-dialog" aria-labelledby="visual-crop-title"><h2 id="visual-crop-title">Обложка направления · 4:3</h2><label>JPG, PNG, WebP · до 5 МБ<input id="visual-file" type="file" accept="image/jpeg,image/png,image/webp"></label><canvas id="visual-canvas" width="600" height="450" hidden aria-label="Предварительный просмотр обложки"></canvas><label>Масштаб<input id="visual-zoom" type="range" min="1" max="3" step="0.01" value="1"></label><label>По горизонтали<input id="visual-x" type="range" min="0" max="1" step="0.01" value="0.5"></label><label>По вертикали<input id="visual-y" type="range" min="0" max="1" step="0.01" value="0.5"></label><p id="visual-crop-status" role="status"></p><div class="visual-dialog-actions"><button type="button" id="visual-apply" disabled>Применить к карточке</button><button type="button" data-visual="cancel-crop">Отмена</button></div></dialog>`;document.body.append(root);
  const crop=document.querySelector('#visual-crop');crop.addEventListener('close',clearCrop);
  document.querySelector('#visual-file').addEventListener('change',loadImage);
  for(const id of ['visual-zoom','visual-x','visual-y'])document.querySelector('#'+id).addEventListener('input',drawCrop);
  document.querySelector('#visual-apply').addEventListener('click',applyCrop);
 }
 function openCrop(id){if(!editable())return;ensureDialogs();clearCrop();cropId=id;document.querySelector('#visual-file').value='';document.querySelector('#visual-canvas').hidden=true;document.querySelector('#visual-apply').disabled=true;document.querySelector('#visual-crop-status').textContent='Фотография пока не отправляется в облако.';document.querySelector('#visual-crop').showModal()}
 async function loadImage(){const generation=++cropGeneration,id=cropId,file=document.querySelector('#visual-file').files[0];cropImage=null;document.querySelector('#visual-apply').disabled=true;if(!file)return;
  const status=document.querySelector('#visual-crop-status');status.textContent='Готовим предпросмотр…';
  try{await validateImage(file);if(generation!==cropGeneration)return;if(cropUrl)URL.revokeObjectURL(cropUrl);cropUrl=URL.createObjectURL(file);const image=new Image();image.src=cropUrl;await image.decode();if(generation!==cropGeneration||cropId!==id)return;if(image.naturalWidth*image.naturalHeight>40000000)throw new Error('Максимальное разрешение — 40 мегапикселей.');cropImage=image;for(const [key,value] of [['zoom',1],['x',.5],['y',.5]])document.querySelector('#visual-'+key).value=value;document.querySelector('#visual-canvas').hidden=false;document.querySelector('#visual-apply').disabled=false;drawCrop();status.textContent='Настройте кадр и примените его к карточке. Затем нажмите «Сохранить» в панели.'}
  catch(error){if(generation===cropGeneration)status.textContent=error.message||'Не удалось открыть изображение.'}
 }
 function crop(){return cropRect(cropImage.naturalWidth,cropImage.naturalHeight,...['zoom','x','y'].map(key=>document.querySelector('#visual-'+key).value))}
 function drawCrop(){if(!cropImage)return;const c=crop(),canvas=document.querySelector('#visual-canvas');canvas.getContext('2d').drawImage(cropImage,c.sx,c.sy,c.sw,c.sh,0,0,600,450)}
 async function applyCrop(){if(!cropImage||!editable())return;const id=cropId,generation=cropGeneration;const button=document.querySelector('#visual-apply');button.disabled=true;
  try{const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;const c=crop();canvas.getContext('2d').drawImage(cropImage,c.sx,c.sy,c.sw,c.sh,0,0,1200,900);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));if(generation!==cropGeneration)return;if(!blob)throw new Error('Не удалось подготовить обложку.');const imageUrl=URL.createObjectURL(blob);try{editor.patch(id,{blob,imageUrl})}catch(error){URL.revokeObjectURL(imageUrl);throw error}document.querySelector('#visual-crop').close()}
  catch(error){document.querySelector('#visual-crop-status').textContent=error.message;button.disabled=false}
 }
 async function save(){try{const success=await editor.save();if(success)await refresh();return success}catch(error){editor.state.error=true;editor.state.message=error.message;renderControls();return false}}
 async function finish(signout=false){const action=async()=>{editor.exit();if(signout){const {error}=await client.auth.signOut({scope:'local'});if(error){editor.state.error=true;editor.state.message='Не удалось выйти. Повторите попытку.';renderControls()}else editor.authorize(false)}};
  if(editor.dirty||cropImage){ensureDialogs();actionAfterSave=action;if(window.A45Feedback){const anchor=document.querySelector(signout?'[data-visual=signout]':'[data-visual=finish]')||controls();window.A45Feedback.show(anchor,{tone:'warning',title:'Сохранить изменения?',message:'Есть несохранённые изменения. Выберите действие перед выходом.',actions:[{label:'Сохранить',primary:true,run:()=>handleAction('save-finish')},{label:'Не сохранять',run:()=>handleAction('discard-finish')}]})}else document.querySelector('#visual-unsaved').showModal()}else await action();
 }
 function needsWarning(){return editor.dirty||editor.state.saving||!!cropImage}
 function guardUrl(url){if(!needsWarning()||url===lastRoute)return true;if(editor.state.saving)return false;if(window.A45Feedback){const anchor=document.activeElement?.closest('a,button')||controls().querySelector('[data-visual=finish]')||controls();const navigate=()=>{approvedRoute=url;history.pushState(null,'',url);window.dispatchEvent(new Event('hashchange'))};window.A45Feedback.show(anchor,{tone:'warning',title:'Сохранить перед переходом?',message:'Есть несохранённые изменения. Закройте подсказку, чтобы продолжить редактирование.',actions:[{label:'Сохранить',primary:true,run:async()=>{if(cropImage){window.A45Feedback.show(document.querySelector('#visual-apply'),{tone:'error',message:'Сначала примените кадр обложки.'});return}if(await save())navigate()}},{label:'Не сохранять',run:()=>{editor.discard();clearCrop();document.querySelector('#visual-crop')?.close();navigate()}}]});return false}return window.confirm('Есть несохранённые изменения. Перейти на другую страницу? Черновик останется в этой вкладке до сохранения или отмены.')}
 async function handleAction(action){if(action==='enter'){try{if(!await service.isAdmin())throw new Error('Войдите администратором.');editor.hydrate(await service.listAdmin());editor.authorize(true);editor.enter()}catch(error){editor.state.error=true;editor.state.message=error.message;renderControls()}}
  if(action==='preview')editor.preview();if(action==='save')await save();if(action==='finish')await finish();if(action==='signout')await finish(true);
  if(action==='cancel-crop')document.querySelector('#visual-crop').close();
  if(action==='cancel-finish'){actionAfterSave=null;document.querySelector('#visual-unsaved').close()}
  if(action==='discard-finish'){editor.discard();clearCrop();document.querySelector('#visual-crop')?.close();document.querySelector('#visual-unsaved').close();const next=actionAfterSave;actionAfterSave=null;await next?.()}
  if(action==='save-finish'){if(cropImage&&window.A45Feedback){window.A45Feedback.show(document.querySelector('#visual-apply'),{tone:'error',message:'Сначала примените кадр обложки.'});return}document.querySelector('#visual-unsaved').close();if(await save()){const next=actionAfterSave;actionAfterSave=null;await next?.()}}
 }
 function afterRender(){lastRoute=location.pathname+location.search+location.hash;decorateCards();renderControls()}
 function beforeRouteChange(){const url=location.pathname+location.search+location.hash;if(approvedRoute===url){approvedRoute=null;return true}if(!guardUrl(url)){history.replaceState(null,'',lastRoute);return false}return true}
 async function mountLogin(){const root=document.querySelector('#main');if(!service){root.innerHTML='<section class="admin-page"><h1>Вход</h1><p>Supabase не настроен.</p></section>';return}
  const current=()=>location.hash.startsWith('#/login')||(!location.hash&&location.pathname==='/login');
  const returnTo=new URLSearchParams((location.hash.split('?')[1]||location.search.slice(1))).get('return');
  mountAuthForm({root,client,service,current,onSuccess:async()=>{await checkAuth();if(current()){const target=returnTo?.startsWith('#/')&&!returnTo.startsWith('#/login')?returnTo:'#/';history.replaceState(null,'','/'+target);window.dispatchEvent(new Event('hashchange'))}}});
 }
 function start(){if(started)return;started=true;checkAuth();
  // Capture before the site's delegated click handler so edit fields never navigate.
  document.addEventListener('click',event=>{const action=event.target.closest('[data-visual]');if(action){event.preventDefault();handleAction(action.dataset.visual);return}
   const card=event.target.closest('[data-category-card]');if(card&&editable()){event.preventDefault();if(event.target.closest('img'))openCrop(card.dataset.categoryCard);return}
   const anchor=event.target.closest('a[href]');if(!anchor||anchor.hasAttribute('download')||anchor.target==='_blank'||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   const url=new URL(anchor.href,location.href);if(url.origin!==location.origin){if(editor.state.saving)event.preventDefault();return}
   const target=url.pathname+url.search+url.hash;if(target===lastRoute)return;const spa=url.hash.startsWith('#/')||['/login','/admin','/'].includes(url.pathname);if(!spa){if(editor.state.saving)event.preventDefault();return}
   if(!guardUrl(target)){event.preventDefault();event.stopImmediatePropagation()}else{approvedRoute=target;if(url.pathname!==location.pathname&&(url.hash.startsWith('#/')||['/login','/admin'].includes(url.pathname))){event.preventDefault();history.pushState(null,'',target);window.dispatchEvent(new Event('hashchange'))}}
  },true);
  document.addEventListener('input',event=>{const field=event.target.closest('[data-edit-field]'),card=field?.closest('[data-category-card]');if(field&&card&&editable())editor.patch(card.dataset.categoryCard,{[field.dataset.editField]:field.textContent.replace(/\u00a0/g,' ')})});
  document.addEventListener('keydown',event=>{if(event.target.matches?.('[data-edit-field="title"]')&&event.key==='Enter'){event.preventDefault();event.target.blur()}if(event.target.matches?.('[data-category-card] img')&&editable()&&['Enter',' '].includes(event.key)){event.preventDefault();openCrop(event.target.closest('[data-category-card]').dataset.categoryCard)}});
  window.addEventListener('beforeunload',event=>{if(needsWarning()){event.preventDefault();event.returnValue=''}});renderControls();
 }
 return {subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener)},state:editor.state,enter:()=>handleAction('enter'),get dirty(){return editor.dirty},get editing(){return editor.state.editing},hydrate:rows=>editor.hydrate(rows),start,checkAuth,afterRender,beforeRouteChange,mountLogin,save,editor};
}
