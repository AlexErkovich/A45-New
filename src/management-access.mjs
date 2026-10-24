import {isAdminRoute} from './access-routes.mjs';
// All callbacks are presentation/data cleanup only. Supabase RLS remains authoritative.
export function createManagementAccess({window,authService,client,projectEditor,onAuthorized=()=>{},onClear=()=>{},onError=()=>{},redirectToLogin}){
 let generation=0,pending=null;
 const active=()=>isAdminRoute(window.location)&&window.A45Management===true;
 function invalidate(){generation++;pending=null;window.A45Management=false;onClear()}
 function leave(){if(window.A45Management||pending)invalidate()}
 async function authorize(){
  if(!isAdminRoute(window.location)||pending)return;
  const token=++generation;
  const request=(async()=>{
   try{
    const allowed=await authService?.isAdmin();
    if(token!==generation||!isAdminRoute(window.location))return;
    if(!allowed){invalidate();redirectToLogin();return}
    window.A45Management=true;onAuthorized();
   }catch{
    if(token===generation&&isAdminRoute(window.location)){invalidate();onError('Не удалось проверить доступ. Повторите попытку. Для управления необходима проверка администратора.')}
   }
  })();
  pending=request;
  try{await request}finally{if(pending===request)pending=null}
 }
 async function logout(){
  if(projectEditor.dirty){onError('Сначала сохраните проект или завершите редактирование.');return false}
  try{const result=await client.auth.signOut({scope:'local'});if(result.error)throw result.error}
  catch{onError('Не удалось выйти. Повторите попытку.');return false}
  window.history.replaceState(null,'','/');invalidate();window.dispatchEvent(new window.Event('hashchange'));return true;
 }
 function sessionEnded(){invalidate();projectEditor.lock?.();if(isAdminRoute(window.location))redirectToLogin();else window.dispatchEvent(new window.Event('hashchange'))}
 return {active,authorize,leave,invalidate,logout,sessionEnded};
}
