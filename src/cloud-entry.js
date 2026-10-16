import { createClient } from '@supabase/supabase-js';
import { createCategoryService, cropRect, validateImage } from './category-service.mjs';
const config=__A45_SUPABASE_CONFIG__;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const client=config?createClient(config.url,config.key,{auth:{detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}}):null;
const service=client?createCategoryService(client):null;
let refreshCallback,refreshing=false,lastData='',adminGeneration=0,previewUrl=null,lastSelectedId=null;
async function refresh(){if(!service||refreshing)return;refreshing=true;try{const rows=await service.listPublic();const snapshot=JSON.stringify(rows);if(snapshot!==lastData){lastData=snapshot;refreshCallback?.(rows,service.coverUrl)}}catch{window.dispatchEvent(new CustomEvent('a45-cloud-error'))}finally{refreshing=false}}
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
  if(!await service.isAdmin()){if(current())root.innerHTML='<section class="admin-page"><h1>Доступ закрыт</h1><p>У этой учётной записи нет прав администратора.</p><button id="admin-signout">Выйти</button></section>';root.querySelector('#admin-signout')?.addEventListener('click',signout);return}
  const rows=await service.listAdmin();if(!current())return;renderEditor(rows);
 }catch{if(current())root.innerHTML='<section class="admin-page"><h1>Нет соединения</h1><p>Не удалось проверить доступ или загрузить категории. Проверьте настройки Supabase и сеть.</p><button id="admin-retry">Повторить</button></section>';root.querySelector('#admin-retry')?.addEventListener('click',mountAdmin)}
 async function signout(){await client.auth.signOut({scope:'local'});if(current())mountAdmin()}
 function renderLogin(){root.innerHTML=`<section class="admin-page admin-login"><h1>Вход администратора</h1><p>Публичная регистрация не предусмотрена.</p><form id="admin-login-form"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Пароль<input name="password" type="password" autocomplete="current-password" required></label><button class="primary" type="submit">Войти</button><p data-admin-status role="status" aria-live="polite"></p></form></section>`;
  root.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const form=e.target;const button=form.querySelector('button');button.disabled=true;message(root,'Вход…');const {error}=await client.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});form.elements.password.value='';if(!current())return;if(error){message(root,'Не удалось войти. Проверьте email и пароль.',true);button.disabled=false}else mountAdmin()})
 }
 function renderEditor(rows){
  let selected=null,decoded=null,busy=false;const rowMap=new Map(rows.map(c=>[c.id,c]));
  function path(c){const names=[];for(let n=c;n;n=rowMap.get(n.parent_id))names.unshift(n.title);return names.join(' / ')}
  const ordered=[...rows].sort((a,b)=>path(a).localeCompare(path(b),'ru'));
  root.innerHTML=`<section class="admin-page"><div class="admin-heading"><h1>Направления</h1><button id="admin-signout">Выйти</button></div><p class="muted">Название, описание и обложка. Изменения сохраняются в облаке.</p><div class="admin-layout"><nav class="admin-list" aria-label="Категории">${ordered.map(c=>`<button type="button" data-edit-category="${escape(c.id)}">${escape(path(c))}</button>`).join('')}</nav><div id="category-editor"><p>Выберите категорию слева.</p></div></div></section>`;
  root.querySelector('#admin-signout').addEventListener('click',signout);
  root.querySelector('.admin-list').addEventListener('click',e=>{const button=e.target.closest('[data-edit-category]');if(!button||busy)return;selectCategory(rowMap.get(button.dataset.editCategory))});
  function selectCategory(category){releaseImage();decoded=null;selected=category;lastSelectedId=category.id;root.querySelectorAll('[data-edit-category]').forEach(b=>b.classList.toggle('active',b.dataset.editCategory===category.id));
   root.querySelector('#category-editor').innerHTML=`<form id="category-edit-form"><h2>${escape(path(category))}</h2><label>Название<input name="title" required maxlength="160" value="${escape(category.title)}"></label><label>Описание<textarea name="description" rows="4" maxlength="4000">${escape(category.description)}</textarea></label><label>Обложка · JPG, PNG, WebP · до 5 МБ<input name="cover" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="admin-current-cover">${category.cover_image_path?`<img src="${escape(service.coverUrl(category.cover_image_path))}" alt="Текущая обложка">`:'<p class="muted">Обложка ещё не загружена. На сайте используется локальная иллюстрация.</p>'}</div><fieldset id="crop-controls" hidden><legend>Кадрирование 4:3</legend><canvas id="crop-preview" width="600" height="450" aria-label="Предварительный просмотр кадрирования"></canvas><label>Масштаб<input name="zoom" type="range" min="1" max="3" step="0.01" value="1"></label><label>Положение по горизонтали<input name="x" type="range" min="0" max="1" step="0.01" value="0.5"></label><label>Положение по вертикали<input name="y" type="range" min="0" max="1" step="0.01" value="0.5"></label></fieldset><button class="primary" type="submit">Сохранить изменения</button><p data-admin-status role="status" aria-live="polite"></p></form>`;
   const form=root.querySelector('form'),canvas=root.querySelector('canvas');
   const draw=()=>{if(!decoded)return;const c=cropRect(decoded.naturalWidth,decoded.naturalHeight,form.elements.zoom.value,form.elements.x.value,form.elements.y.value);canvas.getContext('2d').drawImage(decoded,c.sx,c.sy,c.sw,c.sh,0,0,600,450)};
   for(const name of ['zoom','x','y'])form.elements[name].addEventListener('input',draw);
   let fileGeneration=0;
   form.elements.cover.addEventListener('change',async()=>{const change=++fileGeneration;const file=form.elements.cover.files[0];decoded=null;releaseImage();root.querySelector('#crop-controls').hidden=true;if(!file)return;
    try{await validateImage(file);if(!current()||change!==fileGeneration||selected!==category)return;const url=URL.createObjectURL(file);previewUrl=url;const img=new Image();img.src=url;await img.decode();if(!current()||change!==fileGeneration||selected!==category)return;if(img.naturalWidth*img.naturalHeight>40000000)throw new Error('Слишком большое разрешение: максимум 40 мегапикселей.');decoded=img;root.querySelector('#crop-controls').hidden=false;draw();message(root,'Проверьте кадр. Фотография загрузится только после сохранения.')}catch(error){if(current()&&change===fileGeneration&&selected===category){form.elements.cover.value='';releaseImage();message(root,error.message||'Не удалось открыть изображение.',true)}}
   });
   form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;if(form.elements.cover.files.length&&!decoded){message(root,'Дождитесь загрузки и предварительного просмотра фотографии.',true);return}busy=true;const controls=[...form.elements];controls.forEach(c=>c.disabled=true);message(root,'Сохраняем…');
    try{let blob=null;if(decoded){const output=document.createElement('canvas');output.width=1200;output.height=900;const c=cropRect(decoded.naturalWidth,decoded.naturalHeight,form.elements.zoom.value,form.elements.x.value,form.elements.y.value);output.getContext('2d').drawImage(decoded,c.sx,c.sy,c.sw,c.sh,0,0,1200,900);blob=await new Promise(resolve=>output.toBlob(resolve,'image/webp',.88));if(!blob)throw new Error('Не удалось подготовить фотографию.')}
     const result=await service.save(category,{title:form.elements.title.value,description:form.elements.description.value,blob});rowMap.set(result.category.id,result.category);if(!current())return;selected=result.category;releaseImage();decoded=null;lastData='';await refresh();if(!current())return;
     // Feedback survives the editor remount, and no old object is deleted before DB success.
     sessionStorage.setItem('a45-admin-message',result.warning||'Изменения сохранены. Обложка обновится на публичном сайте без деплоя.');mountAdmin();
    }catch(error){if(current())message(root,error.message||'Не удалось сохранить изменения.',true)}finally{busy=false;if(current())controls.forEach(c=>c.disabled=false)}
   });
  }
  if(ordered.length)selectCategory(rowMap.get(lastSelectedId)||ordered[0]);
  const notice=sessionStorage.getItem('a45-admin-message');if(notice){message(root,notice);sessionStorage.removeItem('a45-admin-message')}
 }
}
window.A45Cloud={configured:!!config,mountAdmin,releaseImage,start(callback){refreshCallback=callback;refresh();if(service){setInterval(refresh,60000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'&&isAdminRoute())setTimeout(mountAdmin,0)})}}};
