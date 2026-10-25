import * as accessRoutes from './access-routes.mjs';
import {createManagementAccess} from './management-access.mjs';
import {createPublicClient} from './public-client.mjs';
window.A45Routes=accessRoutes;
window.A45Management=false;
import {documentGrid,installDocumentNameTooltips} from './ui/document-types.mjs';
import {installMediaRefresh,refreshMediaElements} from './ui/media-refresh.mjs';
import {createTransferPage} from './transfer-page.mjs';
import {removeProject} from './project-removal.mjs';
import {ensureCategory} from './category-placement.mjs';
import {createProjectCardEditor} from './project-card.mjs';
import * as sharedUI from './ui/components.mjs';
window.A45UI=sharedUI;
window.A45PhotoCarousel=sharedUI.openPhotoCarousel;
window.A45Documents={render:documentGrid};
installDocumentNameTooltips(document);
document.addEventListener('click',event=>{const button=event.target.closest('[data-open-document]');if(!button||button.closest('[data-document-editor]'))return;const grid=button.closest('.document-grid'),items=[...grid.querySelectorAll('[data-document-item]')].map(row=>JSON.parse(row.dataset.documentItem));sharedUI.openDocumentDialog({items,id:button.dataset.openDocument,resolveMedia:(path,options)=>window.A45Cloud?.resolveMedia(path,options)})});
import {visibleCategory} from './category-covers.mjs';
import { createCardCreation } from './card-creation.mjs';
import { createProjectService } from './project-service.mjs';
import { createProjectEditor } from './project-editor.mjs';
import { richText,escape as projectEscape,safeUrl,publicProject as projectServiceToPublic } from './project-model.mjs';
import { createClient } from '@supabase/supabase-js';
import {redirectToLogin,returnFromLogin,isLoginRoute} from './session-navigation.mjs';
import { mountAuthForm } from './auth-form.mjs';
import { createCategoryService } from './category-service.mjs';
const config=__A45_SUPABASE_CONFIG__;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const baseClient=config?createClient(config.url,config.key,{auth:{detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}}):null;
const client=baseClient;
const publicClient=createPublicClient(createClient,config);
const publicCategories=publicClient?createCategoryService(publicClient,{navigation:true}):null;
const publicProjects=publicClient?createProjectService(publicClient,publicCategories):null;
const viewingMedia=()=>management.active()?projectService:publicProjects;
const authService=baseClient?createCategoryService(baseClient):null;
const service=client?createCategoryService(client,{navigation:true,onSessionExpired:redirectToLogin}):null;
const projectService=client?createProjectService(client,service):null;
const editableProjects=projectService;
if(projectService){installMediaRefresh(document,(...args)=>viewingMedia()?.resolveMedia(...args));window.addEventListener('a45-refresh-project-media',event=>{const sources=refreshMediaElements(document,event.detail);window.dispatchEvent(new CustomEvent('a45-media-urls',{detail:sources}))})}
const saveProjectCard=createProjectCardEditor({service:editableProjects,ensureCategory:async id=>{const rows=await service.listAdmin();await ensureCategory(service,id,new Set(rows.map(r=>r.id)))}});
const transferPage=createTransferPage({authService,projectService:baseClient?createProjectService(baseClient,authService):null,refresh:async()=>{lastData='';await refresh();await refreshProjects()}});
const projectEditor=createProjectEditor({service:editableProjects,categoryService:service,refresh:refreshProjects,requireAdmin:true});
const cardCreation=createCardCreation({categoryService:service,projectService,refreshCategories:async()=>{lastData='';await refresh()},refreshProjects});
let projectRefreshing=false,hasProjectMetadata=false;
async function refreshProjects(){if(!publicProjects||projectRefreshing)return;projectRefreshing=true;try{const emit=projects=>window.dispatchEvent(new CustomEvent('a45-projects',{detail:projects}));const projects=await publicProjects.publicList(projects=>{if(!hasProjectMetadata){hasProjectMetadata=true;emit(projects)}});emit(projects)}catch(error){window.dispatchEvent(new CustomEvent('a45-project-error',{detail:error.message}))}finally{projectRefreshing=false}}
let refreshCallback,refreshing=false,lastData='';
async function refresh(){if(!publicCategories||refreshing)return;refreshing=true;try{const rows=(await publicCategories.listPublic()).map(visibleCategory);const snapshot=JSON.stringify(rows);if(snapshot!==lastData){lastData=snapshot;refreshCallback?.(rows,publicCategories.coverUrl,{navigation:publicCategories.navigation})}}catch{window.dispatchEvent(new CustomEvent('a45-cloud-error'))}finally{refreshing=false}}
function mountLogin(){
 const root=document.querySelector('#main');
 if(!service){root.innerHTML='<section class="admin-page"><h1>Вход</h1><p>Supabase не настроен.</p></section>';return}
 const returnTo=new URLSearchParams(location.hash.split('?')[1]||location.search.slice(1)).get('return');
 mountAuthForm({root,client,service:authService,current:isLoginRoute,onSuccess:()=>{if(isLoginRoute())returnFromLogin(returnTo)}});
 client.auth.getSession().then(async({data:{session}})=>{
  if(!session||!isLoginRoute()||!await authService.isAdmin()||!isLoginRoute())return;
  returnFromLogin(returnTo);
 }).catch(()=>{});
}
function releaseImage(){}
function requireManagement(){if(!management.active())throw Error('Управление доступно только после входа в /admin.')}
const managed=fn=>(...args)=>{requireManagement();return fn(...args)};
// Approve a logical action once; DOM replacement must not replay or discard a click.
async function runAdminAction(action,anchor){
 if(!management.active())return false;
 const context=location.pathname+location.search+location.hash;
 let allowed;
 try{allowed=await authService.isAdmin()}
 catch{if(management.active()&&context===location.pathname+location.search+location.hash)window.A45Feedback?.show((anchor?.id?document.getElementById(anchor.id):null)||document.querySelector('#section-actions')||anchor,{tone:'error',message:'Не удалось проверить доступ. Повторите попытку.'});return false}
 if(!management.active()||context!==location.pathname+location.search+location.hash)return false;
 if(!allowed){management.invalidate();redirectToLogin();return false}
 await action();return true;
}
async function loadManagedProject(id){requireManagement();const doc=await projectService.get(id);const project={...projectServiceToPublic(doc,await projectService.publicUrls(doc)),editorPreview:doc.status!=='published',status:doc.status};requireManagement();return project}
async function listDraftProjects(){
 requireManagement();if(!projectService)throw Error('Серверное сохранение недоступно.');
 const docs=(await projectService.list(true)).filter(doc=>doc.status==='draft');
 const rows=await Promise.all(docs.map(async doc=>({...projectServiceToPublic(doc,await projectService.publicUrls(doc)),editorPreview:true,status:'draft'})));
 requireManagement();return rows;
}
const management=createManagementAccess({window,authService,client,projectEditor,redirectToLogin,
 onClear(){sharedUI.clearManagementNavigation();projectService?.clearMedia();window.dispatchEvent(new Event('a45-clear-previews'))},
 onAuthorized(){
  const nav=document.querySelector('#navigation');
  nav.replaceChildren();nav.hidden=true;
  sharedUI.renderManagementNavigation({active:management.active(),onLogout:()=>management.logout()});
  window.dispatchEvent(new Event('hashchange'));
 },
 onError(message){
  if(management.active()){window.A45Feedback?.show(document.querySelector('#management-navigation')||document.querySelector('#navigation'),{tone:'error',message});return}
  const root=document.querySelector('#main');if(!accessRoutes.isAdminRoute())return;
  root.innerHTML='<section class="admin-page"><p role="alert"></p><button type="button" class="ui-button ui-button--outline" data-retry-access>Повторить</button></section>';
  root.querySelector('p').textContent=message;root.querySelector('[data-retry-access]').onclick=()=>management.authorize();
 }
});
async function deleteSection(id){
 if(!await authService.isAdmin()){redirectToLogin();throw Error('Войдите администратором для удаления раздела.')}
 const nav=await authService.getNavigation();if(!nav?.entries)throw Error('Сначала синхронизируйте структуру на странице «Данные и перенос».');
 const removed=new Set([id]);let size=-1;while(size!==removed.size){size=removed.size;for(const row of nav.entries)if(removed.has(row.parentId))removed.add(row.id)}
 const result=await authService.saveNavigation(nav.entries.filter(row=>!removed.has(row.id)),nav.revision);lastData='';await refresh();
 return {restore:async()=>{await authService.saveNavigation(nav.entries,result.revision);lastData='';await refresh()}};
}
window.A45Cloud={
 onlineOnly:true,authorizeManagement:management.authorize,leaveManagement:management.leave,
 releaseCard:id=>{saveProjectCard.release(id);cardCreation.release(id)},
 mountTransfer:managed(transferPage.mount),deleteSection:managed(deleteSection),
 deleteProjectCard:managed(id=>removeProject({id,onlineOnly:true,service:editableProjects,storage:localStorage,projects:window.archiveData.projects,refresh:refreshProjects})),
 saveProjectCard:managed(saveProjectCard),saveCategory:managed(async(row,changes)=>{const result=await service.save(row,changes);lastData='';await refresh();return result}),
 createCard:managed(cardCreation.create),largeImage:path=>viewingMedia()?.largeUrl(path),resolveMedia:(path,options)=>viewingMedia()?.resolveMedia(path,options),
 runAdminAction,configured:!!config,retryCategories:refresh,listDraftProjects,loadManagedProject,mountLogin,projectEditor,richText,projectEscape,safeUrl,releaseImage,
 start(callback){
  refreshCallback=callback;projectEditor.start();refresh();refreshProjects();
  if(service){
   setInterval(()=>{refresh();refreshProjects();if(management.active())window.dispatchEvent(new Event('a45-drafts-refresh'))},60000);
   window.addEventListener('focus',()=>{refresh();refreshProjects()});
   document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
   client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')setTimeout(()=>{management.sessionEnded();refreshProjects()},0)});
  }
 }
};
