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
 navigate('/#/login?return='+encodeURIComponent(target));
}
export function returnFromLogin(returnTo){
 let target='/';
 if(typeof returnTo==='string'){
  const candidate=returnTo.startsWith('#/')?'/'+returnTo:returnTo;
  const url=new URL(candidate,location.origin);
  if(candidate.startsWith('/')&&!candidate.startsWith('//')&&url.origin===location.origin&&((url.pathname==='/'&&!url.hash.startsWith('#/login'))||(/^\/project\/(new|drafts|edit\/[a-zA-Z0-9-]+)$/.test(url.pathname)&&!url.hash)||['/admin','/transfer'].includes(url.pathname)))target=url.pathname+url.search+url.hash;
 }
 navigate(target);
 if(suspendedDialog?.isConnected){document.body.classList.add('home-modal-open');suspendedDialog.showModal();suspendedDialog.querySelector('[name=title]')?.focus()}
 suspendedDialog=null;
}
