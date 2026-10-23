import {createTransferPage} from './transfer-page.mjs';
import {removeProject} from './project-removal.mjs';
import {ensureCategory} from './category-placement.mjs';
import {createProjectCardEditor} from './project-card.mjs';
import * as sharedUI from './ui/components.mjs';
window.A45UI=sharedUI;
window.A45PhotoCarousel=sharedUI.openPhotoCarousel;
import {withLocalProjects} from './local-projects.mjs';
import {creationKey,creationClient} from './creation-mode.mjs';
import {visibleCategory} from './category-covers.mjs';
import { createCardCreation } from './card-creation.mjs';
import { createProjectService } from './project-service.mjs';
import { createProjectEditor } from './project-editor.mjs';
import { richText,escape as projectEscape,safeUrl } from './project-model.mjs';
import { createClient } from '@supabase/supabase-js';
import {redirectToLogin,returnFromLogin,isLoginRoute} from './session-navigation.mjs';
import { mountAuthForm } from './auth-form.mjs';
import { createCategoryService, cropRect, validateImage } from './category-service.mjs';
const config=__A45_SUPABASE_CONFIG__;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const temporaryCreation=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
const baseClient=config?createClient(config.url,config.key,{global:temporaryCreation?{headers:{'x-a45-creation-key':creationKey(localStorage)}}:undefined,auth:{detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}}):null;
const client=baseClient?(temporaryCreation?creationClient(baseClient):baseClient):null;
const authService=baseClient?createCategoryService(baseClient):null;
const service=client?createCategoryService(client,{creationMode:temporaryCreation,navigation:true,onSessionExpired:temporaryCreation?()=>{}:redirectToLogin}):null;
const projectService=client?createProjectService(client,service):null;
const editableProjects=withLocalProjects(projectService);
const saveProjectCard=createProjectCardEditor({service:editableProjects,ensureCategory:async id=>{const rows=await service.listAdmin();await ensureCategory(service,id,new Set(rows.map(r=>r.id)))}});
const transferPage=createTransferPage({authService,projectService:createProjectService(baseClient,authService),refresh:async()=>{lastData='';await refresh();await refreshProjects()}});
const projectEditor=createProjectEditor({service:editableProjects,categoryService:service,refresh:refreshProjects,requireAdmin:!temporaryCreation});
const cardCreation=createCardCreation({categoryService:service,projectService,refreshCategories:async()=>{lastData='';await refresh()},refreshProjects});
let projectRefreshing=false,hasProjectMetadata=false;
async function refreshProjects(){if(!projectService||projectRefreshing)return;projectRefreshing=true;try{const emit=projects=>window.dispatchEvent(new CustomEvent('a45-projects',{detail:projects}));const projects=await projectService.publicList(projects=>{if(!hasProjectMetadata){hasProjectMetadata=true;emit(projects)}});emit(projects)}catch(error){window.dispatchEvent(new CustomEvent('a45-project-error',{detail:error.message}))}finally{projectRefreshing=false}}
let refreshCallback,refreshing=false,lastData='',adminGeneration=0,previewUrl=null,lastSelectedId=null,adminNotice='';
async function refresh(){if(!service||refreshing)return;refreshing=true;try{const rows=(await service.listPublic()).map(visibleCategory);const snapshot=JSON.stringify(rows);if(snapshot!==lastData){lastData=snapshot;refreshCallback?.(rows,service.coverUrl,{navigation:service.navigation})}}catch{window.dispatchEvent(new CustomEvent('a45-cloud-error'))}finally{refreshing=false}}
function mountLogin(){const root=document.querySelector('#main');if(!service){root.innerHTML='<section class="admin-page"><h1>Вход</h1><p>Supabase не настроен.</p></section>';return}const returnTo=new URLSearchParams(location.hash.split('?')[1]||location.search.slice(1)).get('return');mountAuthForm({root,client,service:authService,current:isLoginRoute,onSuccess:()=>{if(isLoginRoute())returnFromLogin(returnTo)}})}
function releaseImage(){if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null}}
function message(root,text,error=false){const box=root.querySelector('[data-admin-status]');if(box){box.textContent=text;box.classList.toggle('error',error)}}
const isAdminRoute=()=>location.hash.startsWith('#/admin')||(!location.hash&&location.pathname==='/admin');
function setupMessage(){return `<section class="admin-page"><h1>Администрирование</h1><p>Supabase пока не настроен. Нужны переменные SUPABASE_URL и SUPABASE_PUBLISHABLE_KEY, проверенные миграции и учётная запись администратора.</p><a href="/#/">Вернуться на сайт</a></section>`}
async function mountAdmin(){
 const generation=++adminGeneration;releaseImage();const root=document.querySelector('#main');const current=()=>generation===adminGeneration&&isAdminRoute();
 if(!service){root.innerHTML=setupMessage();return}
 root.innerHTML='<section class="admin-page"><h1>Администрирование</h1><p role="status">Проверяем сессию…</p></section>';
 try{
  const {data:{session},error}=await client.auth.getSession();if(error)throw error;if(!current())return;
  if(!session){renderLogin();return}
  if(!await authService.isAdmin()){if(current())root.innerHTML='<section class="admin-page"><h1>Доступ закрыт</h1><p>У этой учётной записи нет прав администратора.</p><button id="admin-signout">Выйти</button></section>';root.querySelector('#admin-signout')?.addEventListener('click',signout);return}
  const rows=await service.listAdmin();if(!current())return;renderEditor(rows);
 }catch{if(current())root.innerHTML='<section class="admin-page"><h1>Нет соединения</h1><p>Не удалось проверить доступ или загрузить категории. Проверьте настройки Supabase и сеть.</p><button id="admin-retry">Повторить</button></section>';root.querySelector('#admin-retry')?.addEventListener('click',mountAdmin)}
 async function signout(){await client.auth.signOut({scope:'local'});if(current())mountAdmin()}
 function renderLogin(){mountAuthForm({root,client,service:authService,current,onSuccess:async()=>{mountAdmin()}})}
 function renderEditor(rows){
  let selected=null,decoded=null,busy=false;const rowMap=new Map(rows.map(c=>[c.id,c]));
  function path(c){const names=[];for(let n=c;n;n=rowMap.get(n.parent_id))names.unshift(n.title);return names.join(' / ')}
  const ordered=[...rows].sort((a,b)=>path(a).localeCompare(path(b),'ru'));
  root.innerHTML=`<section class="admin-page"><div class="admin-heading"><h1>Направления</h1><button id="admin-signout">Выйти</button></div><p class="muted">Название, описание и обложка. Изменения сохраняются в облаке.</p><div class="admin-layout"><nav class="admin-list" aria-label="Категории">${ordered.map(c=>`<button type="button" data-edit-category="${escape(c.id)}">${escape(path(c))}</button>`).join('')}</nav><div id="category-editor"><p>Выберите категорию слева.</p></div></div></section>`;
  root.querySelector('#admin-signout').addEventListener('click',signout);
  root.querySelector('.admin-list').addEventListener('click',e=>{const button=e.target.closest('[data-edit-category]');if(!button||busy)return;selectCategory(rowMap.get(button.dataset.editCategory))});
  function selectCategory(category){releaseImage();decoded=null;selected=category;lastSelectedId=category.id;root.querySelectorAll('[data-edit-category]').forEach(b=>b.classList.toggle('active',b.dataset.editCategory===category.id));
   root.querySelector('#category-editor').innerHTML=`<form id="category-edit-form"><h2>${escape(path(category))}</h2><label>Название<input name="title" required maxlength="160" value="${escape(category.title)}"></label><label>Описание<textarea name="description" rows="4" maxlength="4000">${escape(category.description)}</textarea></label>${sharedUI.uploadDropzone({label:'Обложка раздела',hint:'JPEG, PNG, WebP · до 5 МБ',buttonLabel:category.cover_image_path?'Заменить обложку':'Загрузить',preview:category.cover_image_path?service.coverUrl(category.cover_image_path):'',inputAttributes:'name="cover" accept="image/jpeg,image/png,image/webp"'})}<fieldset id="crop-controls" hidden><legend>Кадрирование 4:3</legend><canvas id="crop-preview" width="600" height="450" aria-label="Предварительный просмотр кадрирования"></canvas><label>Масштаб<input name="zoom" type="range" min="1" max="3" step="0.01" value="1"></label><label>Положение по горизонтали<input name="x" type="range" min="0" max="1" step="0.01" value="0.5"></label><label>Положение по вертикали<input name="y" type="range" min="0" max="1" step="0.01" value="0.5"></label></fieldset><button class="primary" type="submit">Сохранить изменения</button><p data-admin-status role="status" aria-live="polite"></p></form>`;
   const form=root.querySelector('form'),canvas=root.querySelector('canvas');sharedUI.bindDropzones(root);const dropzone=form.querySelector('[data-ui-dropzone]');
   const draw=()=>{if(!decoded)return;const c=cropRect(decoded.naturalWidth,decoded.naturalHeight,form.elements.zoom.value,form.elements.x.value,form.elements.y.value);canvas.getContext('2d').drawImage(decoded,c.sx,c.sy,c.sw,c.sh,0,0,600,450)};
   for(const name of ['zoom','x','y'])form.elements[name].addEventListener('input',draw);
   let fileGeneration=0;
   const receiveCover=async files=>{const change=++fileGeneration;const file=files[0];if(files.length>1){message(root,'Для обложки выберите один файл.',true);return}decoded=null;releaseImage();root.querySelector('#crop-controls').hidden=true;if(!file)return;
    try{sharedUI.setDropzoneState(dropzone,{busy:true,error:false});await validateImage(file);if(!current()||change!==fileGeneration||selected!==category)return;const url=URL.createObjectURL(file);previewUrl=url;const img=new Image();img.src=url;await img.decode();if(!current()||change!==fileGeneration||selected!==category)return;if(img.naturalWidth*img.naturalHeight>40000000)throw new Error('Слишком большое разрешение: максимум 40 мегапикселей.');decoded=img;sharedUI.setDropzoneState(dropzone,{preview:url});root.querySelector('#crop-controls').hidden=false;draw();message(root,'Проверьте кадр. Фотография загрузится только после сохранения.')}catch(error){if(current()&&change===fileGeneration&&selected===category){form.elements.cover.value='';releaseImage();message(root,error.message||'Не удалось открыть изображение.',true);sharedUI.setDropzoneState(dropzone,{preview:category.cover_image_path?service.coverUrl(category.cover_image_path):'',error:true})}}finally{if(change===fileGeneration)sharedUI.setDropzoneState(dropzone,{busy:false})}
   };form.elements.cover.addEventListener('change',()=>receiveCover([...form.elements.cover.files]));form.addEventListener('ui-files',event=>receiveCover(event.detail.files));
   form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;if(dropzone.getAttribute('aria-busy')==='true'||(form.elements.cover.files.length&&!decoded)){message(root,'Дождитесь загрузки и предварительного просмотра фотографии.',true);return}busy=true;const controls=[...form.elements];controls.forEach(c=>c.disabled=true);message(root,'Сохраняем…');
    try{let blob=null;if(decoded){const output=document.createElement('canvas');output.width=1200;output.height=900;const c=cropRect(decoded.naturalWidth,decoded.naturalHeight,form.elements.zoom.value,form.elements.x.value,form.elements.y.value);output.getContext('2d').drawImage(decoded,c.sx,c.sy,c.sw,c.sh,0,0,1200,900);blob=await new Promise(resolve=>output.toBlob(resolve,'image/webp',.88));if(!blob)throw new Error('Не удалось подготовить фотографию.')}
     const result=await service.save(category,{title:form.elements.title.value,description:form.elements.description.value,blob});rowMap.set(result.category.id,result.category);if(!current())return;selected=result.category;releaseImage();decoded=null;lastData='';await refresh();if(!current())return;
     // Feedback survives the editor remount, and no old object is deleted before DB success.
     adminNotice=result.warning||'Изменения сохранены. Обложка обновится на публичном сайте без деплоя.';mountAdmin();
    }catch(error){if(current())message(root,error.message||'Не удалось сохранить изменения.',true)}finally{busy=false;if(current())controls.forEach(c=>c.disabled=false)}
   });
  }
  if(ordered.length)selectCategory(rowMap.get(lastSelectedId)||ordered[0]);
  if(adminNotice){message(root,adminNotice);adminNotice=''}
 }
}
async function deleteSection(id){
 if(!await authService.isAdmin()){if(temporaryCreation)return null;redirectToLogin();throw Error('Войдите администратором для удаления раздела.')}
 const nav=await authService.getNavigation();if(!nav?.entries)throw Error('Сначала синхронизируйте структуру на странице «Данные и перенос».');
 const removed=new Set([id]);let size=-1;while(size!==removed.size){size=removed.size;for(const row of nav.entries)if(removed.has(row.parentId))removed.add(row.id)}
 const result=await authService.saveNavigation(nav.entries.filter(row=>!removed.has(row.id)),nav.revision);lastData='';await refresh();
 return {restore:async()=>{await authService.saveNavigation(nav.entries,result.revision);lastData='';await refresh()}};
}
window.A45Cloud={mountTransfer:transferPage.mount,deleteSection,deleteProjectCard:id=>removeProject({id,service:editableProjects,storage:localStorage,projects:window.archiveData.projects,refresh:refreshProjects}),saveProjectCard,saveCategory:async(row,changes)=>{const result=await service.save(row,changes);lastData="";await refresh();return result},createCard:cardCreation.create,largeImage:path=>projectService.largeUrl(path),configured:!!config,mountAdmin,mountLogin,projectEditor,richText,projectEscape,safeUrl,releaseImage,start(callback){if(!temporaryCreation&&authService)document.addEventListener('click',event=>{const button=event.target.closest('#home-edit,#home-add,#section-edit,#section-add,[data-nav-add]');if(!button||button.dataset.accessChecked==='true')return;event.preventDefault();event.stopImmediatePropagation();authService.isAdmin().then(allowed=>{if(allowed){button.dataset.accessChecked='true';button.click();delete button.dataset.accessChecked}else redirectToLogin()}).catch(()=>window.A45Feedback?.show(button,{tone:'error',message:'Не удалось проверить доступ. Повторите попытку.'}))},true);refreshCallback=callback;const nav=document.querySelector('#navigation');if(nav&&!nav.querySelector('[data-data-transfer]'))nav.insertAdjacentHTML('beforeend','<a href="/#/transfer" data-data-transfer>Данные и перенос</a><a href="/login">Вход</a>');projectEditor.start();refresh();refreshProjects();if(service){setInterval(()=>{refresh();refreshProjects()},60000);window.addEventListener('focus',()=>{refresh();refreshProjects()});document.addEventListener('visibilitychange',()=>{if(!document.hidden){refresh()}});client.auth.onAuthStateChange(event=>{setTimeout(()=>{if(event==='SIGNED_OUT'){window.dispatchEvent(new Event('a45-clear-previews'));refreshProjects()}},0);if(event==='SIGNED_OUT'&&isAdminRoute())setTimeout(mountAdmin,0)})}}};
