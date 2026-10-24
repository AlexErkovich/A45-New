import {adminReturnTarget} from './access-routes.mjs';
// Authentication detours stay inside the SPA so editor drafts and selected files survive.
export let sessionTransition=false;
let suspendedDialog=null;
export function isLoginRoute(){return location.hash.startsWith('#/login')||(!location.hash&&location.pathname==='/login')}
function navigate(target){sessionTransition=true;try{history.replaceState(null,'',target);window.dispatchEvent(new Event('hashchange'))}finally{sessionTransition=false}}
export function redirectToLogin(){
 if(isLoginRoute())return;
 const target=location.pathname+location.search+location.hash;
 const dialog=document.querySelector('#home-section-dialog[open]');
 if(dialog){suspendedDialog=dialog;window.A45Feedback?.clearWithin(dialog);dialog.close();document.body.classList.remove('home-modal-open')}
 navigate('/login?return='+encodeURIComponent(target));
}
export function returnFromLogin(returnTo){
 const target=adminReturnTarget(returnTo);
 navigate(target);
 if(suspendedDialog?.isConnected){document.body.classList.add('home-modal-open');suspendedDialog.showModal();suspendedDialog.querySelector('[name=title]')?.focus()}
 suspendedDialog=null;
}
