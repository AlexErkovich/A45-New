'use strict';
const {categories,projects}=window.archiveData;
// Keep the reference blocks and append any other sections shown on the homepage.
const menuBlocks=[
 {id:'photography',title:'Фотография',items:[['product-photo','Предметная фотография'],['reportage-photo','Репортажная'],['macro','Макросъемка'],['studio-photo','Студийная'],['film-photo','Пленочные проекты']]},
 {id:'video',title:'Видео',items:[['wedding-video','Свадебная съемка'],['editing','Монтаж'],['reportage-video','Репортаж']]},
 {id:'technical',title:'Техническое творчество',items:[['arduino','Ардуино'],['camera-equipment','Кинооператорское оборудование']]},
 {id:'pedagogy',title:'Педагогика',items:[['teaching-methods','Методические разработки'],['teaching-projects','Проекты']]}
];
for(const block of menuBlocks){
 if(!categories.some(c=>c.id===block.id))categories.push({id:block.id,title:block.title,parentId:null,slug:block.id,description:'',sortOrder:categories.length});
 for(const [index,[id,title]] of block.items.entries())if(!categories.some(c=>c.id===id))categories.push({id,title,parentId:block.id,slug:id,description:'',sortOrder:index});
}
// Replace this adapter with a remote data source when the archive grows.
const repository={categories:()=>categories,projects:()=>projects};
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const filterState={category:'',subcategory:'',year:'',type:''};
const expanded=new Set();
let route={};
let remoteRootCategories=null;
let archiveScrollTop=0;
let mobileMenuOpen=false;
let backgroundScrollTop=0;
const categoryById=new Map(categories.map(c=>[c.id,c]));
const legacyRoots=['photography','video','drawing','texts','technical','it','graphics-3d'];
function childrenOf(id=null){return categories.filter(c=>c.parentId===id&&!window.A45Home?.isDeleted(c.id)).sort((a,b)=>a.sortOrder-b.sortOrder||a.title.localeCompare(b.title,'ru'))}
function categoryPath(id){const path=[];for(let c=categoryById.get(id);c;c=categoryById.get(c.parentId))path.unshift(c);return path}
function isWithin(id,parentId){return categoryPath(id).some(c=>c.id===parentId)}
function belongsTo(project,categoryId=''){return !categoryId||project.categoryIds.some(id=>isWithin(id,categoryId))}
function parseRoute(){if(!location.hash&&/^\/project\/(new|drafts|edit\/[^/]+)$/.test(location.pathname))return {page:'project-editor',id:'',category:null,tab:'overview'};if(!location.hash&&['/admin','/login'].includes(location.pathname))return {page:location.pathname.slice(1),id:'',category:null,tab:'overview'};const [path,query='']=location.hash.slice(2).split('?');let [page='home',id='',sub='']=path.split('/');const params=new URLSearchParams(query);if(page==='category'){id=legacyRoots[id]||id;if(sub)id=childrenOf(id).find(c=>c.title===decodeURIComponent(sub))?.id||id}let category=params.get('category');category=legacyRoots[category]||category;const legacySub=params.get('subcategory');if(legacySub)category=childrenOf(category).find(c=>c.title===legacySub)?.id||category;return {page:page||'home',id,category,tab:params.get('tab')||'overview'}}
function findProject(id){return projects.find(p=>p.id===id||p.slug===id)}
function projectContext(project){return categoryById.get(route.category)&&belongsTo(project,route.category)?categoryById.get(route.category):categoryById.get(project.categoryIds[0])}
function projectHref(project){return '#/project/'+(project.cloud?project.slug:project.id)+(route.page==='category'?'?'+new URLSearchParams({category:route.id}):'')}
function placementLabel(project){return project.categoryIds.map(id=>categoryPath(id).map(c=>c.title).join(' / ')).join(' · ')}
function matches(p){const {category,subcategory,year,type}=filterState;return (!subcategory||!category||isWithin(subcategory,category))&&belongsTo(p,subcategory||category)&&(!year||String(p.year)===year)&&(!type||p.type===type)}
function breadcrumbs(cat){return '<a href="#/">Главная</a>'+categoryPath(cat?.id).map(c=>` / <a href="#/category/${c.id}">${esc(c.title)}</a>`).join('')}
function activeCategoryIds(){if(route.page==='category')return [route.id];if(route.page==='project')return findProject(route.id)?.categoryIds||[];return []}
function card(item,isCategory=false){return `<a class="card" ${isCategory?`data-category-card="${esc(item.id)}"`:""} href="#/${isCategory?'category/'+item.id:projectHref(item).slice(2)}"><img src="${item.image}" alt="${esc(item.title)} — демонстрационная иллюстрация" loading="lazy"><div class="card-body"><h2>${esc(item.title)}</h2><p>${esc(item.description)}</p></div></a>`}
// Block surfaces disclose and open their project list; subsection links open their own list.
function navigationBlocks(){
 const home=window.A45Home?.sections(remoteRootCategories)??remoteRootCategories??childrenOf();
 return [...menuBlocks,...home.filter(c=>!menuBlocks.some(b=>b.id===c.id)).map(c=>({id:c.id,title:c.title,items:childrenOf(c.id).map(child=>[child.id,child.title])}))];
}
function treeNodes(){return navigationBlocks().map(block=>{
 const open=expanded.has(block.id);
 const active=route.page==='project'?projectContext(findProject(route.id)||{categoryIds:[]})?.id:route.id;
 return `<section class="menu-block" data-menu-block="${block.id}"><h2 class="menu-block-heading"><button type="button" class="menu-block-title" data-category="${block.id}" aria-controls="branch-${block.id}" aria-expanded="${open}">${esc(block.title)}</button></h2><div id="branch-${block.id}" class="menu-block-items" ${open&&block.items.length?'':'hidden inert'}>${block.items.map(([id,title])=>`<a class="menu-item" data-category="${id}" href="#/category/${id}" ${active===id?'aria-current="page"':''}>${esc(title)}</a>`).join('')}</div></section>`;
 }).join('')}
function tree(){const archive=$('#archive');archive.innerHTML='<button type="button" id="close-archive" class="archive-close">Закрыть меню</button><nav class="category-tree" aria-label="Категории">'+treeNodes()+'</nav>';archive.scrollTop=archiveScrollTop}
function toggleBranch(id,force){
 const open=force??!expanded.has(id);
 if(open)expanded.add(id);else expanded.delete(id);
 const branch=$('#branch-'+id);
 if(branch){const archive=$('#archive'),top=archive.scrollTop;branch.hidden=!open;branch.inert=!open;$(`[data-category="${id}"]`).setAttribute('aria-expanded',String(open));archive.scrollTop=top}
}

function setMobileMenu(open){
 if(open===mobileMenuOpen)return;
 const page=document.scrollingElement;
 if(open){backgroundScrollTop=page.scrollTop;document.body.style.top=`-${backgroundScrollTop}px`}
 else archiveScrollTop=$('#archive').scrollTop;
 mobileMenuOpen=open;
 document.documentElement.classList.toggle('archive-menu-open',open);
 $('#archive').classList.toggle('open',open);
 $('#archive-toggle')?.setAttribute('aria-expanded',String(open));
 if(open){$('#archive').scrollTop=archiveScrollTop;$('#close-archive')?.focus({preventScroll:true})}
 else{document.body.style.top='';page.scrollTop=backgroundScrollTop;$('#archive-toggle')?.focus({preventScroll:true})}
}
function render(){route=parseRoute();window.A45Home?.header(route.page==='home');document.body.classList?.toggle('archive-page',['category','project','year','projects'].includes(route.page));const internal=['category','project','year','projects'].includes(route.page);const project=findProject(route.id);const cat=route.page==='project'&&project?projectContext(project):categoryById.get(route.id);$('#layout').classList.toggle('internal',internal);if(internal)tree();$('#main').classList.toggle('home',route.page==='home');$('#main').classList.toggle('listing',['category','projects','year'].includes(route.page));document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===route.page));let html='';const archiveButton=internal?'<button class="archive-toggle" id="archive-toggle" aria-expanded="false" aria-controls="archive">☰ Дерево архива</button>':'';
if(['admin','login','project-editor'].includes(route.page)){html='<section class="admin-page"><h1>Администрирование</h1><p>Загрузка…</p></section>'}
else if(route.page==='about'){html=`<div class="about"><div class="eyebrow">ОБ АРХИВЕ</div><h1>Творчество —<br>способ смотреть на мир.</h1><p>A45 — персональная творческая библиотека. Здесь собираются фотографии, тексты, визуальные исследования и проекты на пересечении искусства и технологий.</p><p>Это пространство для поиска, экспериментов и сохранения того, что хочется помнить.</p><p>Пока архив наполнен демонстрационными материалами. Постепенно здесь появятся настоящие работы и истории их создания.</p><a class="back-link" href="#/">К направлениям творчества ↗</a></div>`}
else if(route.page==='home'){html=`<div class="card-grid" aria-label="Направления творчества">${(window.A45Home?.sections(remoteRootCategories)??remoteRootCategories??childrenOf()).map(c=>card(c,true)).join('')}</div>`}
else if(route.page==='project'&&project){html=ProjectPage.render(project,cat,route.tab)}
else if(['projects','category','year'].includes(route.page)&& (route.page!=='category'||cat)){
let items=projects.filter(matches);
let title='Все проекты';
if(route.page==='category'){items=items.filter(p=>belongsTo(p,cat.id));title=menuBlocks.flatMap(b=>b.items).find(([id])=>id===cat.id)?.[1]||cat.title}
else if(route.page==='year'){items=items.filter(p=>String(p.year)===route.id);title='Архив / '+route.id}
const filtered=Object.values(filterState).some(Boolean);
html=`<div class="crumbs">${cat?breadcrumbs(cat):'<a href="#/">Главная</a> / '+esc(title)}</div><div class="section-heading" ${cat?`data-current-category="${esc(cat.id)}"`:""}><h1>${esc(title)}</h1><button id="open-filter" aria-haspopup="dialog" aria-controls="filters">Фильтр${filtered?' · '+Object.values(filterState).filter(Boolean).length:''}</button></div>${cat?.description?`<p class="category-description">${esc(cat.description)}</p>`:''}${filtered?'<div class="active-note">Фильтры применены · <button id="clear-all">Сбросить</button></div>':''}${items.length?`<div class="card-grid">${items.map(i=>card(i)).join('')}</div>`:'<div class="empty">По выбранным условиям ничего не найдено. Попробуйте сбросить фильтры.</div>'}`}

else{html='<h1>Страница не найдена</h1><a href="#/">← На главную</a>'}
$('#main').innerHTML=archiveButton+html;if(route.page==='project-editor'){window.A45Cloud?.projectEditor.mount()}else if(route.page==='login'){window.A45Cloud?.visual.mountLogin()}else if(route.page==='admin'){if(window.A45Cloud)window.A45Cloud.mountAdmin();else $('#main').innerHTML='<section class="admin-page"><h1>Администрирование</h1><p>Выполните npm run build, чтобы подготовить интеграцию Supabase.</p></section>'}else window.A45Cloud?.releaseImage();if(internal)$('#archive-toggle').setAttribute('aria-expanded',String($('#archive').classList.contains('open')));document.title=(route.page==='login'?'Вход администратора':route.page==='home'?'Направления творчества':project&&route.page==='project'?project.title:cat?.title||'Творческий архив')+' — A45';window.A45Cloud?.visual.afterRender();window.A45Cloud?.projectEditor?.decorate();window.A45Home?.afterRender();sectionActions(cat,internal);}
function sectionActions(cat,internal){
 let actions=$('#section-actions');
 if(!actions)return;
 actions.hidden=!internal;
 if(!internal)return;
 $('#navigation').hidden=true;
 const categoryId=cat?.id||'';
 actions.innerHTML=`<button type="button" id="section-edit">${window.A45Icons?.pencil||'✎'} Редактировать</button><a class="section-add" href="/project/new${categoryId?'?'+new URLSearchParams({category:categoryId}):''}"><span aria-hidden="true">＋</span> Добавить</a>`;
}

function options(name,values,selected){const select=$(`[name="${name}"]`);select.innerHTML='<option value="">Все</option>'+values.map(v=>{const [id,label]=Array.isArray(v)?v:[v,v];return `<option value="${esc(id)}">${esc(label)}</option>`}).join('');select.value=selected}
function subOptions(){const root=$('[name="category"]').value;const descendants=categories.filter(c=>c.parentId!==null&&(!root||isWithin(c.id,root)));options('subcategory',descendants.map(c=>[c.id,categoryPath(c.id).slice(root?1:0).map(n=>n.title).join(' / ')]),filterState.subcategory)}
function openFilters(){options('category',childrenOf().map(c=>[c.id,c.title]),filterState.category);subOptions();options('year',[2026,2025,2024],filterState.year);options('type',['Статья','Фотография','Видео','Проект','Исследование'],filterState.type);$('#filters').showModal()}
document.addEventListener('click',e=>{if(e.target.closest('#section-edit')){if(window.A45Cloud?.visual.state.authorized)window.A45Cloud.visual.enter();else location.hash='#/login?return='+encodeURIComponent(location.hash);return}const tabLink=e.target.closest('[data-project-tab]');if(tabLink&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();if(location.hash!==tabLink.getAttribute('href'))history.pushState(null,'',tabLink.getAttribute('href'));handleRouteChange();return}const image=e.target.closest('[data-project-image]');if(image)ProjectPage.openImage(image);if(e.target.closest('#close-lightbox'))$('#project-lightbox').close();const blockSurface=e.target.closest('[data-menu-block]');if(blockSurface&&!e.target.closest('a')){e.preventDefault();toggleBranch(blockSurface.dataset.menuBlock);const href='#/category/'+blockSurface.dataset.menuBlock;if(location.hash!==href)history.pushState(null,'',href);handleRouteChange();return}if(e.target.closest('#open-filter'))openFilters();if(e.target.closest('#close-filter'))$('#filters').close();if(e.target.closest('#clear-all')){Object.keys(filterState).forEach(k=>filterState[k]='');render()}if(e.target.closest('#archive-toggle'))setMobileMenu(!mobileMenuOpen);if(e.target.closest('#close-archive'))setMobileMenu(false)});
$('[name="category"]').addEventListener('change',subOptions);
$('#filter-form').addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.target);Object.keys(filterState).forEach(k=>filterState[k]=data.get(k));$('#filters').close();render()});
$('#reset-filter').addEventListener('click',()=>{Object.keys(filterState).forEach(k=>filterState[k]='');openFiltersReset();render()});function openFiltersReset(){for(const s of document.querySelectorAll('select'))s.value='';subOptions()}
$('#filters').addEventListener('click',e=>{if(e.target===$('#filters')&&e.clientX<$('#filters').getBoundingClientRect().left)$('#filters').close()});
$('#archive').addEventListener('scroll',()=>{if(['category','project','year','projects'].includes(route.page)&&(!mobileViewport.matches||mobileMenuOpen))archiveScrollTop=$('#archive').scrollTop},{passive:true});
document.addEventListener('keydown',e=>{ProjectPage.keydown(e);if(mobileMenuOpen&&e.key==='Escape')setMobileMenu(false)});
const mobileViewport=window.matchMedia('(max-width: 767px)');
mobileViewport.addEventListener('change',e=>{if(!e.matches)setMobileMenu(false)});
function handleRouteChange(){if(window.A45Cloud?.projectEditor?.beforeRouteChange()===false)return;if(window.A45Cloud?.visual.beforeRouteChange()===false)return;const next=parseRoute();const previousProject=route.page==='project'?findProject(route.id):null;const nextProject=next.page==='project'?findProject(next.id):null;if(previousProject&&previousProject===nextProject&&route.category===next.category){route=next;ProjectPage.update(nextProject,next.tab);window.A45Cloud?.visual.afterRender();return}setMobileMenu(false);render();document.scrollingElement.scrollTop=0}
if(typeof history!=='undefined'&&'scrollRestoration' in history)history.scrollRestoration='manual';
window.addEventListener('hashchange',handleRouteChange);render();

// Cloud metadata overlays the existing stable category IDs; routing/tree structure stays local.
window.A45Cloud?.start((rows,coverUrl)=>{
 const byId=new Map(rows.map(c=>[c.id,c]));
 remoteRootCategories=childrenOf().filter(c=>byId.has(c.id)).map(c=>{
  const remote=byId.get(c.id);
  return {...c,title:remote.title,description:remote.description,cover_image_path:remote.cover_image_path,image:remote.cover_image_path?coverUrl(remote.cover_image_path):c.image};
 });
 if(['home','category','project','year','projects'].includes(route.page)&&!window.A45Cloud?.visual.editing){const top=document.scrollingElement.scrollTop;render();document.scrollingElement.scrollTop=top}
});

// Remote projects join local demonstrations without replacing their IDs or routes.
window.A45Archive={preview(project,target){const cat=categoryById.get(project.categoryIds[0]);target.innerHTML=ProjectPage.render(project,cat,'overview');target.querySelector('.project-tabs')?.remove();target.querySelector('.back-link')?.remove();target.querySelector('.project-share')?.remove();const nav=document.createElement('div');nav.className='project-editor-tabs';ProjectTabs.list(project).forEach(tab=>{const b=document.createElement('button');b.type='button';b.textContent=tab.title;b.addEventListener('click',()=>{target.querySelector('.project-panel').innerHTML=ProjectPage.content(tab.type,tab.content)});nav.append(b)});target.prepend(nav)}};
window.addEventListener('a45-projects',event=>{const previous=JSON.stringify(projects.filter(p=>p.cloud));const local=projects.filter(p=>!p.cloud);const incoming=event.detail.filter(p=>!local.some(x=>x.id===p.id||x.slug===p.slug));projects.splice(0,projects.length,...local,...incoming);if(previous!==JSON.stringify(incoming)&&['category','projects','year','project'].includes(route.page)){const top=document.scrollingElement.scrollTop;render();document.scrollingElement.scrollTop=top}});
window.addEventListener('popstate',handleRouteChange);

window.addEventListener("a45-home-change",()=>{categories.forEach(c=>categoryById.set(c.id,c));render()});
