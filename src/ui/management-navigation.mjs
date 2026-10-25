import {actionButton} from './buttons.mjs';
export function clearManagementNavigation({document=globalThis.document}={}){
 document.querySelector('#management-navigation')?.remove();
 document.querySelector('footer')?.classList.remove('has-management-navigation');
}
export function renderManagementNavigation({document=globalThis.document,active=false,onLogout=()=>{}}={}){
 if(!active){clearManagementNavigation({document});return}
 const footer=document.querySelector('footer');if(!footer)return;
 let nav=document.querySelector('#management-navigation');
 if(!nav){nav=document.createElement('nav');nav.id='management-navigation';nav.className='ui-management-nav';nav.setAttribute('aria-label','Управление сайтом');
  nav.innerHTML='<a href="/admin#/about">Обо мне</a><a href="/" data-public-site>Просмотр сайта</a><a href="/admin#/drafts">Черновики</a><a href="/admin#/transfer">Данные и перенос</a>'+actionButton({label:'Выйти',variant:'outline',attributes:'data-admin-logout'});
  footer.append(nav);
 }
 footer.classList.add('has-management-navigation');nav.querySelector('[data-admin-logout]').onclick=onLogout;
 return nav;
}
