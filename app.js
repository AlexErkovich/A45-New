'use strict';
const {categories,projects}=window.archiveData;
// Replace this adapter with a remote data source when the archive grows.
const repository={categories:()=>categories,projects:()=>projects};
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const filterState={category:'',subcategory:'',year:'',type:''};
const expanded=new Set();
let route={};
let treeRouteKey=null;
let archiveScrollTop=0;
let mobileMenuOpen=false;
let backgroundScrollTop=0;
const categoryById=new Map(categories.map(c=>[c.id,c]));
const legacyRoots=['photography','video','drawing','texts','technical','it','graphics-3d'];
function childrenOf(id=null){return categories.filter(c=>c.parentId===id).sort((a,b)=>a.sortOrder-b.sortOrder||a.title.localeCompare(b.title,'ru'))}
function categoryPath(id){const path=[];for(let c=categoryById.get(id);c;c=categoryById.get(c.parentId))path.unshift(c);return path}
function isWithin(id,parentId){return categoryPath(id).some(c=>c.id===parentId)}
function belongsTo(project,categoryId=''){return !categoryId||project.categoryIds.some(id=>isWithin(id,categoryId))}
function parseRoute(){const [path,query='']=location.hash.slice(2).split('?');let [page='home',id='',sub='']=path.split('/');const params=new URLSearchParams(query);if(page==='category'){id=legacyRoots[id]||id;if(sub)id=childrenOf(id).find(c=>c.title===decodeURIComponent(sub))?.id||id}let category=params.get('category');category=legacyRoots[category]||category;const legacySub=params.get('subcategory');if(legacySub)category=childrenOf(category).find(c=>c.title===legacySub)?.id||category;return {page:page||'home',id,category,tab:params.get('tab')||'overview'}}
function findProject(id){return projects.find(p=>p.id===id||p.slug===id)}
function projectContext(project){return categoryById.get(route.category)&&belongsTo(project,route.category)?categoryById.get(route.category):categoryById.get(project.categoryIds[0])}
function projectHref(project){return '#/project/'+project.id+(route.page==='category'?'?'+new URLSearchParams({category:route.id}):'')}
function placementLabel(project){return project.categoryIds.map(id=>categoryPath(id).map(c=>c.title).join(' / ')).join(' · ')}
function matches(p){const {category,subcategory,year,type}=filterState;return (!subcategory||!category||isWithin(subcategory,category))&&belongsTo(p,subcategory||category)&&(!year||String(p.year)===year)&&(!type||p.type===type)}
function breadcrumbs(cat){return '<a href="#/">Главная</a>'+categoryPath(cat?.id).map(c=>` / <a href="#/category/${c.id}">${esc(c.title)}</a>`).join('')}
function activeCategoryIds(){if(route.page==='category')return [route.id];if(route.page==='project')return findProject(route.id)?.categoryIds||[];return []}
function card(item,isCategory=false){return `<a class="card" href="#/${isCategory?'category/'+item.id:projectHref(item).slice(2)}"><img src="${item.image}" alt="${esc(item.title)} — демонстрационная иллюстрация" loading="lazy"><div class="card-body"><h2>${esc(item.title)}</h2><p>${esc(item.description)}</p></div></a>`}
// The same recursive renderer handles every level of the category tree.
function treeNodes(parentId,activeIds){return childrenOf(parentId).map(c=>{const hasChildren=childrenOf(c.id).length>0;const open=expanded.has(c.id);const active=activeIds.includes(c.id);return `<div class="tree-node"><div class="tree-row ${active?'active':''}">${hasChildren?`<button type="button" class="tree-label" data-category="${c.id}" aria-controls="branch-${c.id}" aria-expanded="${open}">${esc(c.title)}</button>`:`<a data-category="${c.id}" href="#/category/${c.id}" ${active?'aria-current="page"':''}>${esc(c.title)}</a>`}</div>${hasChildren?`<div id="branch-${c.id}" class="tree-branch ${open?'expanded':''}" ${open?'':'inert'}><div class="tree-children"><div class="tree-row tree-all"><a href="#/category/${c.id}" ${route.page==='category'&&route.id===c.id?'aria-current="page"':''}>Все проекты</a></div>${treeNodes(c.id,activeIds)}</div></div>`:''}</div>`}).join('')}
function tree(){const archive=$('#archive');archive.innerHTML='<button type="button" id="close-archive" class="archive-close">Закрыть меню</button><div class="tree-title">ТВОРЧЕСКИЙ АРХИВ</div><nav class="category-tree" aria-label="Категории">'+treeNodes(null,activeCategoryIds())+'</nav>'+`<div class="years"><div class="tree-title">ПО ГОДАМ</div>${[2026,2025,2024].map(y=>`<a href="#/year/${y}">${y} <span>(${projects.filter(p=>p.year===y).length})</span></a>`).join('')}</div>`;archive.scrollTop=archiveScrollTop}
function toggleBranch(id,force){const open=force??!expanded.has(id);if(open)expanded.add(id);else expanded.delete(id);const branch=$('#branch-'+id);if(branch){const archive=$('#archive');const top=archive.scrollTop;branch.classList.toggle('expanded',open);branch.inert=!open;$(`[data-category="${id}"]`).setAttribute('aria-expanded',String(open));archive.scrollTop=top}}
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
function render(){route=parseRoute();const internal=['category','project','year','projects'].includes(route.page);const project=findProject(route.id);const cat=route.page==='project'&&project?projectContext(project):categoryById.get(route.id);const nextTreeRouteKey=JSON.stringify([route.page,route.id,route.category]);if(nextTreeRouteKey!==treeRouteKey){if(cat)categoryPath(cat.id).forEach(c=>expanded.add(c.id));if(route.page==='project')project?.categoryIds.forEach(id=>categoryPath(id).forEach(c=>expanded.add(c.id)));treeRouteKey=nextTreeRouteKey;}$('#layout').classList.toggle('internal',internal);if(internal)tree();$('#main').classList.toggle('home',route.page==='home');$('#main').classList.toggle('listing',['category','projects','year'].includes(route.page));document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===route.page));let html='';const archiveButton=internal?'<button class="archive-toggle" id="archive-toggle" aria-expanded="false" aria-controls="archive">☰ Дерево архива</button>':'';
if(route.page==='about'){html=`<div class="about"><div class="eyebrow">ОБ АРХИВЕ</div><h1>Творчество —<br>способ смотреть на мир.</h1><p>A45 — персональная творческая библиотека. Здесь собираются фотографии, тексты, визуальные исследования и проекты на пересечении искусства и технологий.</p><p>Это пространство для поиска, экспериментов и сохранения того, что хочется помнить.</p><p>Пока архив наполнен демонстрационными материалами. Постепенно здесь появятся настоящие работы и истории их создания.</p><a class="back-link" href="#/">К направлениям творчества ↗</a></div>`}
else if(route.page==='home'){html=`<div class="card-grid" aria-label="Направления творчества">${childrenOf().map(c=>card(c,true)).join('')}</div>`}
else if(route.page==='project'&&project){html=ProjectPage.render(project,cat,route.tab)}
else if(['projects','category','year'].includes(route.page)&& (route.page!=='category'||cat)){
let items=projects.filter(matches);
let title='Все проекты';
if(route.page==='category'){items=items.filter(p=>belongsTo(p,cat.id));title=cat.title}
else if(route.page==='year'){items=items.filter(p=>String(p.year)===route.id);title='Архив / '+route.id}
const filtered=Object.values(filterState).some(Boolean);
html=`<div class="crumbs">${cat?breadcrumbs(cat):'<a href="#/">Главная</a> / '+esc(title)}</div><div class="section-heading"><h1>${esc(title)}</h1><button id="open-filter" aria-haspopup="dialog" aria-controls="filters">Фильтр${filtered?' · '+Object.values(filterState).filter(Boolean).length:''}</button></div>${filtered?'<div class="active-note">Фильтры применены · <button id="clear-all">Сбросить</button></div>':''}${items.length?`<div class="card-grid">${items.map(i=>card(i)).join('')}</div>`:'<div class="empty">По выбранным условиям ничего не найдено. Попробуйте сбросить фильтры.</div>'}`}

else{html='<h1>Страница не найдена</h1><a href="#/">← На главную</a>'}
$('#main').innerHTML=archiveButton+html;if(internal)$('#archive-toggle').setAttribute('aria-expanded',String($('#archive').classList.contains('open')));document.title=(route.page==='home'?'Направления творчества':project&&route.page==='project'?project.title:cat?.title||'Творческий архив')+' — A45';}
function options(name,values,selected){const select=$(`[name="${name}"]`);select.innerHTML='<option value="">Все</option>'+values.map(v=>{const [id,label]=Array.isArray(v)?v:[v,v];return `<option value="${esc(id)}">${esc(label)}</option>`}).join('');select.value=selected}
function subOptions(){const root=$('[name="category"]').value;const descendants=categories.filter(c=>c.parentId!==null&&(!root||isWithin(c.id,root)));options('subcategory',descendants.map(c=>[c.id,categoryPath(c.id).slice(root?1:0).map(n=>n.title).join(' / ')]),filterState.subcategory)}
function openFilters(){options('category',childrenOf().map(c=>[c.id,c.title]),filterState.category);subOptions();options('year',[2026,2025,2024],filterState.year);options('type',['Статья','Фотография','Видео','Проект','Исследование'],filterState.type);$('#filters').showModal()}
document.addEventListener('click',e=>{const tabLink=e.target.closest('[data-project-tab]');if(tabLink&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();if(location.hash!==tabLink.getAttribute('href'))history.pushState(null,'',tabLink.getAttribute('href'));handleRouteChange();return}const image=e.target.closest('[data-project-image]');if(image)ProjectPage.openImage(image);if(e.target.closest('#close-lightbox'))$('#project-lightbox').close();const categoryLink=e.target.closest('[data-category]');if(categoryLink&&childrenOf(categoryLink.dataset.category).length){e.preventDefault();toggleBranch(categoryLink.dataset.category)}if(e.target.closest('#open-filter'))openFilters();if(e.target.closest('#close-filter'))$('#filters').close();if(e.target.closest('#clear-all')){Object.keys(filterState).forEach(k=>filterState[k]='');render()}if(e.target.closest('#archive-toggle'))setMobileMenu(!mobileMenuOpen);if(e.target.closest('#close-archive'))setMobileMenu(false)});
$('[name="category"]').addEventListener('change',subOptions);
$('#filter-form').addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.target);Object.keys(filterState).forEach(k=>filterState[k]=data.get(k));$('#filters').close();render()});
$('#reset-filter').addEventListener('click',()=>{Object.keys(filterState).forEach(k=>filterState[k]='');openFiltersReset();render()});function openFiltersReset(){for(const s of document.querySelectorAll('select'))s.value='';subOptions()}
$('#filters').addEventListener('click',e=>{if(e.target===$('#filters')&&e.clientX<$('#filters').getBoundingClientRect().left)$('#filters').close()});
$('#archive').addEventListener('scroll',()=>{if(['category','project','year','projects'].includes(route.page)&&(!mobileViewport.matches||mobileMenuOpen))archiveScrollTop=$('#archive').scrollTop},{passive:true});
document.addEventListener('keydown',e=>{ProjectPage.keydown(e);if(mobileMenuOpen&&e.key==='Escape')setMobileMenu(false)});
const mobileViewport=window.matchMedia('(max-width: 767px)');
mobileViewport.addEventListener('change',e=>{if(!e.matches)setMobileMenu(false)});
function handleRouteChange(){const next=parseRoute();const previousProject=route.page==='project'?findProject(route.id):null;const nextProject=next.page==='project'?findProject(next.id):null;if(previousProject&&previousProject===nextProject&&route.category===next.category){route=next;ProjectPage.update(nextProject,next.tab);return}setMobileMenu(false);render();document.scrollingElement.scrollTop=0}
if(typeof history!=='undefined'&&'scrollRestoration' in history)history.scrollRestoration='manual';
window.addEventListener('hashchange',handleRouteChange);render();
