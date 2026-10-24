'use strict';
const {categories,projects}=window.archiveData;
if(window.A45Cloud?.onlineOnly)projects.splice(0,projects.length);
// Keep the reference blocks and append any other sections shown on the homepage.
const menuBlocks=[
 {id:'photography',title:'Фотография',items:[['product-photo','Предметная фотография'],['reportage-photo','Репортажная'],['macro','Макросъемка'],['studio-photo','Студийная'],['film-photo','Пленочные проекты']]},
 {id:'video',title:'Видео',items:[['wedding-video','Свадебная съемка'],['editing','Монтаж'],['reportage-video','Репортаж']]},
 {id:'technical',title:'Техническое творчество',items:[['arduino','Ардуино'],['camera-equipment','Кинооператорское оборудование'],['eco','Эко']]},
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
let listingEditKey=null;
let remoteRootCategories=null;
let authoritativeNavigation=null;
let projectsLoading=!!window.A45Cloud?.configured;
let draftsStatus='idle',draftProjects=[],draftsError='';
let categoriesLoading=!!window.A45Cloud?.configured,categoriesError=false;
let archiveScrollTop=0;
let pinnedBlockId=null;
let menuScrollInProgress=false,menuScrollTimer=null;
let pinnedResizeObserver=null,observedPinnedBlock=null;
let mobileMenuOpen=false;
let backgroundScrollTop=0;
const categoryById=new Map(categories.map(c=>[c.id,c]));
const legacyRoots=['photography','video','drawing','texts','technical','it','graphics-3d'];
// Duplicate root records can exist after a section was recreated. Keep their
// projects and children reachable from either entry without rewriting stored IDs.
function sameCategory(a,b){const aliases={'film-equipment':'camera-equipment'};a=aliases[a]||a;b=aliases[b]||b;if(a===b)return true;const left=categoryById.get(a),right=categoryById.get(b);return !!left&&!!right&&left.parentId===null&&right.parentId===null&&left.title.trim().toLocaleLowerCase('ru')===right.title.trim().toLocaleLowerCase('ru')}
function childrenOf(id=null){return categories.filter(c=>(id===null?c.parentId===null:sameCategory(c.parentId,id))&&!window.A45Home?.isDeleted(c.id)).sort((a,b)=>a.sortOrder-b.sortOrder||a.title.localeCompare(b.title,'ru'))}
function categoryPath(id){const path=[];for(let c=categoryById.get(id);c;c=categoryById.get(c.parentId))path.unshift(c);return path}
function isWithin(id,parentId){return categoryPath(id).some(c=>sameCategory(c.id,parentId))}
function belongsTo(project,categoryId=''){return !categoryId||project.categoryIds.some(id=>id===categoryId||isWithin(id,categoryId))}
function parseRoute(){if(!location.hash&&location.pathname==='/project/drafts')return {page:'drafts',id:'',category:null,tab:'overview'};if(!location.hash&&/^\/project\/(new|edit\/[^/]+)$/.test(location.pathname))return {page:'project-editor',id:'',category:null,tab:'overview'};if(!location.hash&&['/admin','/login','/transfer'].includes(location.pathname))return {page:location.pathname.slice(1),id:'',category:null,tab:'overview'};const [path,query='']=location.hash.slice(2).split('?');let [page='home',id='',sub='']=path.split('/');const params=new URLSearchParams(query);if(page==='category'){id=legacyRoots[id]||id;if(sub)id=childrenOf(id).find(c=>c.title===decodeURIComponent(sub))?.id||id}let category=params.get('category');category=legacyRoots[category]||category;const legacySub=params.get('subcategory');if(legacySub)category=childrenOf(category).find(c=>c.title===legacySub)?.id||category;return {page:page||'home',id,category,tab:params.get('tab')||'overview'}}
function findProject(id){const migrated=projects.find(p=>p.sourceId===id);if(migrated)return migrated;const alias=window.archiveData.projectAliases?.[id];if(alias&&projects.some(p=>p.id===alias))id=alias;try{const receipt=!window.A45Cloud?.onlineOnly&&JSON.parse(localStorage.getItem('a45-transfer-receipts')||'{}')[id];if(receipt)id=receipt.id}catch{}return projects.find(p=>p.id===id||p.slug===id)}
function projectContext(project){return categoryById.get(route.category)&&belongsTo(project,route.category)?categoryById.get(route.category):categoryById.get(project.categoryIds[0])||{id:project.categoryIds[0],title:'Раздел',parentId:null}}
function projectHref(project){return '#/project/'+(project.cloud?project.slug:project.id)+(route.page==='category'?'?'+new URLSearchParams({category:route.id}):'')}
function placementLabel(project){return project.categoryIds.map(id=>categoryPath(id).map(c=>c.title).join(' / ')).join(' · ')}
function matches(p){if(p.archived)return false;try{if(!window.A45Cloud?.onlineOnly&&JSON.parse(localStorage.getItem('a45-hidden-projects')||'[]').includes(p.id))return false}catch{}const {category,subcategory,year,type}=filterState;return (!subcategory||!category||isWithin(subcategory,category))&&belongsTo(p,subcategory||category)&&(!year||String(p.year)===year)&&(!type||p.type===type)}
function breadcrumbs(cat){return '<a href="#/">Главная</a>'+categoryPath(cat?.id).map(c=>` / <a href="#/category/${c.id}">${esc(c.title)}</a>`).join('')}
function activeCategoryIds(){if(route.page==='category')return [route.id];if(route.page==='project')return findProject(route.id)?.categoryIds||[];return []}
function card(item,isCategory=false){return `<a class="card" ${isCategory?`data-category-card="${esc(item.id)}"`:`data-project-card="${esc(item.id)}"`} href="#/${isCategory?'category/'+item.id:projectHref(item).slice(2)}"><img ${item.imagePath?`data-media-path="${esc(item.imagePath)}"`:""} src="${esc(item.image)}" alt="${esc(item.title)} — демонстрационная иллюстрация" loading="lazy"><div class="card-body"><h2>${esc(item.title)}</h2><p>${esc(item.description)}</p></div></a>`}
// Block surfaces disclose and open their project list; subsection links open their own list.
function navigationBlocks(){
 const home=window.A45Home?.sections(remoteRootCategories)??remoteRootCategories??childrenOf();
 const titleKey=title=>title.trim().toLocaleLowerCase('ru');
 const existing=menuBlocks.filter(block=>(!authoritativeNavigation||authoritativeNavigation.some(c=>c.id===block.id))&&!window.A45Home?.isDeleted(block.id)).map(block=>{
  const categoryId=home.find(c=>c.id===block.id)?.id||home.find(c=>titleKey(c.title)===titleKey(block.title))?.id||block.id;
  const extra=categories.filter(c=>[block.id,categoryId].includes(c.parentId)&&c.custom&&c.id.startsWith('section-')&&!window.A45Home?.isDeleted(c.id)&&!block.items.some(([id])=>id===c.id)).map(c=>[c.id,c.title]);
  return {...block,title:window.A45Home?.editedTitle(categoryId)||categoryById.get(categoryId)?.menuTitle||block.title,categoryId,items:[...block.items.filter(([id])=>(!authoritativeNavigation||authoritativeNavigation.some(c=>c.id===id))&&!window.A45Home?.isDeleted(id)).map(([id,title])=>[id,categoryById.get(id)?.menuTitle||window.A45Home?.editedTitle(id)||title]),...extra]};
 });
 return [...existing,...home.filter(c=>!existing.some(b=>b.id===c.id||titleKey(b.title)===titleKey(c.title))).map(c=>({id:c.id,categoryId:c.id,title:c.title,items:childrenOf(c.id).filter(child=>child.custom&&child.id.startsWith('section-')).map(child=>[child.id,child.title])}))];
}
// Homepage, navigation and placement picker expose the same current taxonomy.
window.A45Navigation={categories(){return navigationBlocks().flatMap((b,index)=>[
 {...categoryById.get(b.categoryId),id:b.categoryId,parentId:null,title:b.title,sortOrder:index},
 ...b.items.filter(([id])=>!window.A45Home?.isDeleted(id)).map(([id,title],i)=>({...categoryById.get(id),id,parentId:b.categoryId,title,sortOrder:i}))
 ])}};
function treeNodes(){return navigationBlocks().map(block=>{
 const open=expanded.has(block.id);
 const active=route.page==='project'?projectContext(findProject(route.id)||{categoryIds:[]})?.id:route.id;
 return `<section class="menu-block" data-menu-block="${block.id}" data-menu-category="${block.categoryId}" data-open="${open&&block.items.length>0}"><h2 class="menu-block-heading"><button type="button" class="menu-block-title" data-category="${block.id}" aria-controls="branch-${block.id}" aria-expanded="${open}">${esc(block.title)}</button><button type="button" class="ui-icon-button menu-add-subsection" data-nav-add="${esc(block.categoryId)}" aria-label="Добавить подраздел в ${esc(block.title)}" title="Добавить подраздел">${window.A45Icons?.plus||''}</button></h2><div id="branch-${block.id}" class="menu-block-items" ${open&&block.items.length?'':'hidden inert'}>${block.items.map(([id,title])=>`<a class="menu-item menu-item-row" data-category="${id}" href="#/category/${id}" ${active===id?'aria-current="page"':''}>${esc(title)}</a>`).join('')}</div></section>`;
 }).join('')}
function navigationTailSpace(){
 const archive=$('#archive'),block=pinnedBlockId&&$(`[data-menu-block="${pinnedBlockId}"]`);
 if(block&&typeof ResizeObserver==='function'&&block!==observedPinnedBlock){
  pinnedResizeObserver?.disconnect();pinnedResizeObserver=new ResizeObserver(navigationTailSpace);observedPinnedBlock=block;pinnedResizeObserver.observe(block);
 }
 const space=block?Math.max(0,(archive.clientHeight||0)-(block.offsetHeight||0)-24):0;
 archive.querySelector?.('.category-tree')?.style?.setProperty?.('--menu-tail-space',space+'px');
}
function pinNavigationBlock(id){
 const archive=$('#archive'),block=$(`[data-menu-block="${id}"]`);if(!block)return;
 pinnedBlockId=id;navigationTailSpace();
 const top=Math.max(0,archive.scrollTop+block.getBoundingClientRect().top-archive.getBoundingClientRect().top-12);
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(typeof archive.scrollTo==='function'&&!reduced&&Math.abs(top-archive.scrollTop)>1){
  menuScrollInProgress=true;
  if(menuScrollTimer)window.clearTimeout(menuScrollTimer);
  archive.scrollTo({top,behavior:'smooth'});
  menuScrollTimer=window.setTimeout(finishMenuScroll,800);
 }else{finishMenuScroll();archive.scrollTop=top}
 archiveScrollTop=archive.scrollTop;
}
function finishMenuScroll(){menuScrollInProgress=false;if(menuScrollTimer)window.clearTimeout(menuScrollTimer);menuScrollTimer=null;archiveScrollTop=$('#archive').scrollTop}
function tree(){
 const archive=$('#archive'),signature=JSON.stringify(navigationBlocks());
 // Keep the menu DOM during route changes so disclosure can finish and focus stays put.
 if(archive.a45MenuSignature!==signature){
  archive.innerHTML=`<button type="button" id="close-archive" class="archive-close">${window.A45Icons?.x||''} Закрыть меню</button><nav class="category-tree" aria-label="Категории">${treeNodes()}</nav>`;
  archive.a45MenuSignature=signature;
 }
 const active=route.page==='project'?projectContext(findProject(route.id)||{categoryIds:[]})?.id:route.id;
 document.querySelectorAll('#archive .menu-item').forEach(link=>{if(link.dataset.category===active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')});
 const activeBlock=navigationBlocks().find(b=>categoryPath(active).some(c=>c.id===b.id||c.id===b.categoryId||b.items.some(([id])=>id===c.id)));
 document.querySelectorAll('#archive [data-menu-block]').forEach(block=>block.setAttribute('data-active',String(block.dataset.menuBlock===activeBlock?.id)));
 if(activeBlock&&activeBlock.id!==pinnedBlockId)pinNavigationBlock(activeBlock.id);else navigationTailSpace();
 if(!menuScrollInProgress&&Math.abs(archive.scrollTop-archiveScrollTop)>1)archive.scrollTop=archiveScrollTop;
}
function toggleBranch(id,force){
 const open=force??!expanded.has(id);
 if(open)for(const other of [...expanded]){if(other===id)continue;expanded.delete(other);const previous=$('#branch-'+other);if(previous){previous.a45Animation?.cancel();previous.a45Animation=null;previous.hidden=true;previous.inert=true;previous.closest?.('[data-menu-block]')?.setAttribute('data-open','false');previous.querySelectorAll?.('.menu-item').forEach(item=>item.a45Animation?.cancel())}$(`[data-category="${other}"]`)?.setAttribute('aria-expanded','false')}
 if(open)expanded.add(id);else expanded.delete(id);
 const branch=$('#branch-'+id);
 if(!branch)return;
 const archive=$('#archive'),top=archive.scrollTop,block=branch.closest?.('[data-menu-block]');
 const hasItems=!!branch.children?.length;
 block?.setAttribute('data-open',String(open&&hasItems));
 $(`[data-category="${id}"]`).setAttribute('aria-expanded',String(open));
 branch.inert=!open;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(!hasItems||typeof branch.animate!=='function'||reduced){branch.hidden=!open||!hasItems;archive.scrollTop=top;return}
 const fromHeight=branch.hidden?0:branch.getBoundingClientRect().height;
 const fromOpacity=branch.hidden?0:getComputedStyle(branch).opacity;
 const fromMargin=branch.hidden?'0px':getComputedStyle(branch).marginTop;
 branch.a45Animation?.cancel();
 branch.hidden=false;
 const animation=branch.animate([
  {height:fromHeight+'px',opacity:fromOpacity,marginTop:fromMargin},
  {height:(open?branch.scrollHeight:0)+'px',opacity:open?1:0,marginTop:open?'12px':'0px'}
 ],{duration:open?440:320,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
 branch.a45Animation=animation;
 animation.onfinish=()=>{branch.hidden=!open;animation.cancel();branch.a45Animation=null;navigationTailSpace()};
 if(open)branch.querySelectorAll('.menu-item').forEach((item,index)=>{
  item.a45Animation?.cancel();
  item.a45Animation=item.animate([{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,delay:Math.min(index,6)*28,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
 });
 archive.scrollTop=top;
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
function render(){route=parseRoute();if(route.page==='admin'){history.replaceState(null,'','/login');route={page:'login',id:'',category:null,tab:'overview'}}if(route.page==='project-editor'){document.body.classList?.add('project-editor-route');document.querySelector('#main')?.classList.remove('home','listing');window.A45Home?.header(false);window.A45Cloud?.projectEditor?.mount();document.title='Редактирование проекта — A45';return}document.body.classList?.remove('project-editor-route','project-canvas-open');if(listingEditKey!==route.page+':'+route.id)listingEditKey=null;window.A45Home?.header(route.page==='home');document.body.classList?.toggle('archive-page',['category','project','year','projects','drafts'].includes(route.page));const internal=['category','project','year','projects','drafts'].includes(route.page);const project=findProject(route.id);const cat=route.page==='project'&&project?projectContext(project):categoryById.get(route.id);$('#layout').classList.toggle('internal',internal);if(internal)tree();$('#main').classList.toggle('home',route.page==='home');$('#main').classList.toggle('listing',['category','projects','year','drafts'].includes(route.page));document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===route.page));let html='';const archiveButton=internal?`<button class="archive-toggle" id="archive-toggle" aria-expanded="false" aria-controls="archive">${window.A45Icons?.menu||''} Дерево архива</button>`:'';
if(['admin','login','transfer','project-editor'].includes(route.page)){html='<section class="admin-page"><h1>Администрирование</h1><p>Загрузка…</p></section>'}
else if(route.page==='about'){html=`<div class="about"><div class="eyebrow">ОБ АРХИВЕ</div><h1>Творчество —<br>способ смотреть на мир.</h1><p>A45 — персональная творческая библиотека. Здесь собираются фотографии, тексты, визуальные исследования и проекты на пересечении искусства и технологий.</p><p>Это пространство для поиска, экспериментов и сохранения того, что хочется помнить.</p><p>Здесь собраны мои работы и истории их создания. Архив пополняется новыми проектами, наблюдениями и открытиями.</p><a class="back-link" href="#/">К направлениям творчества ↗</a></div>`}
else if(route.page==='drafts'){if(draftsStatus==='idle'){draftsStatus='loading';Promise.resolve().then(()=>window.A45Cloud.listDraftProjects()).then(rows=>{draftProjects=rows;draftsStatus='ready';for(const row of rows){const index=projects.findIndex(p=>p.id===row.id);if(index<0)projects.push(row);else projects[index]=row}if(parseRoute().page==='drafts')renderKeepingState()}).catch(error=>{draftsStatus='error';draftsError=error.message;if(parseRoute().page==='drafts')renderKeepingState()})}html=`<div class="section-heading"><h1>Черновики</h1></div>${draftsStatus==='loading'&&!draftProjects.length?'<div class="empty" role="status">Загружаем черновики…</div>':draftsStatus==='error'?`<div class="empty" role="alert">${esc(draftsError)} <button type="button" id="retry-drafts">Повторить</button></div>`:draftProjects.length?`<div class="card-grid">${draftProjects.map(p=>card(p)).join('')}</div>`:'<div class="empty">Черновиков пока нет.</div>'}`}
else if(route.page==='home'&&(categoriesLoading||categoriesError)){html=categoriesLoading?'<div class="empty" role="status">Загружаем разделы…</div>':'<div class="empty" role="alert">Не удалось загрузить разделы. <button type="button" id="retry-categories">Повторить</button></div>'}
else if(route.page==='home'){html=`<div class="card-grid" aria-label="Направления творчества">${(window.A45Home?.sections(remoteRootCategories)??remoteRootCategories??childrenOf()).map(c=>card(c,true)).join('')}</div>`}
else if(route.page==='project'&&!project&&projectsLoading){html='<div class="empty" role="status">Загружаем проект…</div>'}
else if(route.page==='project'&&project){html=ProjectPage.render(project,cat,route.tab)}
else if(['projects','category','year'].includes(route.page)&& (route.page!=='category'||cat)){
let items=projects.filter(matches);
let title='Все проекты';
if(route.page==='category'){items=items.filter(p=>belongsTo(p,cat.id));title=window.A45Home?.editedTitle(cat.id)||cat.menuTitle||menuBlocks.flatMap(b=>b.items).find(([id])=>id===cat.id)?.[1]||cat.title}
else if(route.page==='year'){items=items.filter(p=>String(p.year)===route.id);title='Архив / '+route.id}
const filtered=Object.values(filterState).some(Boolean);const subcategories=cat?childrenOf(cat.id).filter(c=>c.custom):[];
html=`<div class="crumbs">${cat?breadcrumbs(cat):'<a href="#/">Главная</a> / '+esc(title)}</div><div class="section-heading" ${cat?`data-current-category="${esc(cat.id)}"`:""}><h1>${esc(title)}</h1><button id="open-filter" aria-haspopup="dialog" aria-controls="filters">Фильтр${filtered?' · '+Object.values(filterState).filter(Boolean).length:''}</button></div>${cat?.description?`<p class="category-description">${esc(cat.description)}</p>`:''}${filtered?'<div class="active-note">Фильтры применены · <button id="clear-all">Сбросить</button></div>':''}${items.length||subcategories.length?`<div class="card-grid">${subcategories.map(c=>card({...c,image:c.image||cat.image||'assets/visual-0.svg'},true)).join('')}${items.map(i=>card(i)).join('')}</div>`:(projectsLoading?'<div class="empty" role="status">Загружаем проекты…</div>':'<div class="empty">По выбранным условиям ничего не найдено. Попробуйте сбросить фильтры.</div>')}`}

else if(route.page==='category'&&categoriesLoading){html='<div class="empty" role="status">Загружаем раздел…</div>'}
else{html='<h1>Страница не найдена</h1><a href="#/">← На главную</a>'}
if(window.A45Cards)window.A45Cards.render($('#main'),archiveButton+html,location.pathname+location.search+location.hash);else $('#main').innerHTML=archiveButton+html;if(route.page==='project-editor'){window.A45Cloud?.projectEditor.mount()}else if(route.page==='transfer'){window.A45Cloud?.mountTransfer()}else if(route.page==='login'){window.A45Cloud?.mountLogin()}else window.A45Cloud?.releaseImage();if(internal)$('#archive-toggle').setAttribute('aria-expanded',String($('#archive').classList.contains('open')));document.title=(route.page==='login'?'Вход администратора':route.page==='home'?'Направления творчества':project&&route.page==='project'?project.title:cat?.title||'Творческий архив')+' — A45';window.A45Home?.afterRender();sectionActions(cat,internal);decorateListingEdit();}
function sectionActions(cat,internal){
 let actions=$('#section-actions');
 if(!actions)return;
 actions.hidden=!internal;
 if(!internal)return;
 $('#navigation').hidden=true;
 const categoryId=cat?.id||(route.page==='drafts'?window.A45Navigation.categories().find(c=>!c.parentId)?.id:'')||'';
 actions.innerHTML=`<button type="button" class="ui-button ui-button--outline" id="section-edit" ${route.page==='project'?`data-edit-project="${esc(findProject(route.id)?.id||route.id)}"`:`data-edit-listing="${esc(categoryId)}" aria-pressed="${listingEditKey!==null}"`}>${window.A45Icons?.pencil||''} Редактировать</button><button type="button" class="section-add ui-button ui-button--primary" id="section-add" data-parent-category="${esc(categoryId)}" data-create-kind="${cat?.parentId===null?'subcategory':'project'}">${window.A45Icons?.plus||''} Добавить</button>`;
}

function decorateListingEdit(){
 const active=listingEditKey!==null;document.body.classList?.toggle('listing-editing',active);
 const button=$('[data-edit-listing]');if(button){button.setAttribute('aria-pressed',String(active));button.innerHTML=active?`${window.A45Icons?.check||'✓'} Готово`:`${window.A45Icons?.pencil||''} Редактировать`}
 if(!active)return;
 document.querySelectorAll('#main.listing .card').forEach(card=>{if(card.querySelector('.card-edit-outline'))return;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),rect=document.createElementNS('http://www.w3.org/2000/svg','rect');svg.classList.add('card-edit-outline');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');rect.setAttribute('x','1');rect.setAttribute('y','1');svg.append(rect);card.append(svg)})
}

function options(name,values,selected){const select=$(`[name="${name}"]`);select.innerHTML='<option value="">Все</option>'+values.map(v=>{const [id,label]=Array.isArray(v)?v:[v,v];return `<option value="${esc(id)}">${esc(label)}</option>`}).join('');select.value=selected}
function subOptions(){const root=$('[name="category"]').value,current=window.A45Navigation?.categories()||[],byId=new Map(current.map(c=>[c.id,c]));const descendants=current.filter(c=>c.parentId!==null&&(!root||isWithin(c.id,root)));const label=c=>{const path=[],seen=new Set();for(let node=c;node&&!seen.has(node.id);node=byId.get(node.parentId)){seen.add(node.id);if(node.id!==root)path.unshift(node.title)}return path.join(' / ')};options('subcategory',descendants.map(c=>[c.id,label(c)]),filterState.subcategory)}
function openFilters(){options('category',(window.A45Navigation?.categories()||[]).filter(c=>c.parentId===null).map(c=>[c.id,c.title]),filterState.category);subOptions();options('year',[...new Set(projects.map(p=>p.year))].sort((a,b)=>b-a),filterState.year);options('type',['Статья','Фотография','Видео','Проект','Исследование'],filterState.type);$('#filters').showModal()}
document.addEventListener('click',e=>{if(e.target.closest('#retry-categories')){categoriesError=false;categoriesLoading=true;render();window.A45Cloud?.retryCategories();return}if(e.target.closest('#retry-drafts')){draftsStatus='idle';render();return}const navAdd=e.target.closest('[data-nav-add]');if(navAdd){e.preventDefault();window.A45Home?.open(null,{kind:'subcategory',parentId:navAdd.dataset.navAdd});return}const listingToggle=e.target.closest('[data-edit-listing]');if(listingToggle){listingEditKey=listingEditKey===null?route.page+':'+route.id:null;decorateListingEdit();return}const editCard=e.target.closest('#main.listing .card');if(editCard&&listingEditKey!==null&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();if(editCard.dataset.projectCard){const project=findProject(editCard.dataset.projectCard);window.A45Home?.open(project.id,{kind:'project',parentId:route.page==='category'?route.id:project.categoryIds[0]})}else if(editCard.dataset.categoryCard){const c=categoryById.get(editCard.dataset.categoryCard);window.A45Home?.open(c.id,{kind:c.parentId?'subcategory':'section',parentId:c.parentId})}return}const collapse=e.target.closest('[data-collapse-project]');if(collapse){ProjectPage.collapseText(collapse);return}if(e.target.closest('[data-copy-project-link]')){ProjectPage.copyLink(e.target.closest('[data-copy-project-link]'));return}const add=e.target.closest('#section-add');if(add){window.A45Home?.open(null,{kind:add.dataset.createKind,parentId:add.dataset.parentCategory});return}const categoryEdit=e.target.closest('[data-edit-category]');if(categoryEdit){const c=categoryById.get(categoryEdit.dataset.editCategory);window.A45Home?.open(c.id,{kind:c.parentId?'subcategory':'section',parentId:c.parentId});return}const edit=e.target.closest('[data-edit-project]');if(edit){history.pushState(null,'','/project/edit/'+encodeURIComponent(edit.dataset.editProject)+'?'+new URLSearchParams({tab:route.tab||'overview'}));handleRouteChange();return}const tabLink=e.target.closest('[data-project-tab]');if(tabLink&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();if(location.hash!==tabLink.getAttribute('href'))history.pushState(null,'',tabLink.getAttribute('href'));handleRouteChange();return}const image=e.target.closest('[data-project-image]');if(image)ProjectPage.openImage(image);const blockSurface=e.target.closest('[data-menu-block]');if(blockSurface&&!e.target.closest('a')){e.preventDefault();toggleBranch(blockSurface.dataset.menuBlock);pinNavigationBlock(blockSurface.dataset.menuBlock);const href='#/category/'+blockSurface.dataset.menuCategory;if(location.hash!==href)history.pushState(null,'',href);handleRouteChange();return}if(e.target.closest('#open-filter'))openFilters();if(e.target.closest('#close-filter'))$('#filters').close();if(e.target.closest('#clear-all')){Object.keys(filterState).forEach(k=>filterState[k]='');render()}if(e.target.closest('#archive-toggle'))setMobileMenu(!mobileMenuOpen);if(e.target.closest('#close-archive'))setMobileMenu(false)});
$('[name="category"]').addEventListener('change',subOptions);
$('#filter-form').addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.target);Object.keys(filterState).forEach(k=>filterState[k]=data.get(k));$('#filters').close();render()});
$('#reset-filter').addEventListener('click',()=>{Object.keys(filterState).forEach(k=>filterState[k]='');openFiltersReset();render()});function openFiltersReset(){for(const s of document.querySelectorAll('select'))s.value='';subOptions()}
$('#filters').addEventListener('click',e=>{if(e.target===$('#filters')&&e.clientX<$('#filters').getBoundingClientRect().left)$('#filters').close()});
$('#archive').addEventListener('scrollend',finishMenuScroll,{passive:true});
$('#archive').addEventListener('scroll',()=>{if(['category','project','year','projects','drafts'].includes(route.page)&&(!mobileViewport.matches||mobileMenuOpen))archiveScrollTop=$('#archive').scrollTop},{passive:true});
document.addEventListener('keydown',e=>{ProjectPage.keydown(e);if(mobileMenuOpen&&e.key==='Escape')setMobileMenu(false)});
const mobileViewport=window.matchMedia('(max-width: 767px)');
mobileViewport.addEventListener('change',e=>{if(!e.matches)setMobileMenu(false)});
function handleRouteChange(){if(window.A45Cloud?.projectEditor?.beforeRouteChange()===false)return;const next=parseRoute();if(next.page==='drafts'&&route.page!=='drafts')draftsStatus='idle';if(next.page==='project-editor'){setMobileMenu(false);render();return}const previousProject=route.page==='project'?findProject(route.id):null;const nextProject=next.page==='project'?findProject(next.id):null;if(previousProject&&previousProject===nextProject&&route.category===next.category){route=next;ProjectPage.update(nextProject,next.tab);return}setMobileMenu(false);render();document.scrollingElement.scrollTop=0;const main=$('#main');main.a45RouteAnimation?.cancel();if(typeof main.animate==='function'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){main.a45RouteAnimation=main.animate([{opacity:.55},{opacity:1}],{duration:180,easing:'ease-out'});main.a45RouteAnimation.finished?.catch(()=>{})}}
if(typeof history!=='undefined'&&'scrollRestoration' in history)history.scrollRestoration='manual';
window.addEventListener('hashchange',handleRouteChange);render();

// Cloud metadata overlays the existing stable category IDs; routing/tree structure stays local.
window.A45Cloud?.start((rows,coverUrl,metadata)=>{
 authoritativeNavigation=metadata?.navigation||null;window.A45Home?.setNavigation(authoritativeNavigation);
 categoriesLoading=false;categoriesError=false;
 const byId=new Map(rows.map(c=>[c.id,c]));
 for(const remote of rows){let local=categoryById.get(remote.id);const data={id:remote.id,parentId:remote.parent_id,slug:remote.slug,title:remote.title,description:remote.description,sortOrder:remote.sort_order,remoteRow:remote};if(remote.cover_image_path)data.image=coverUrl(remote.cover_image_path);if(local)Object.assign(local,data);else{local={...data,custom:true};categories.push(local);categoryById.set(local.id,local)}}

 remoteRootCategories=childrenOf().filter(c=>byId.has(c.id)).map(c=>{
  const remote=byId.get(c.id);
  return {...c,title:remote.title,description:remote.description,cover_image_path:remote.cover_image_path,image:remote.cover_image_path?coverUrl(remote.cover_image_path):(c.image||'assets/cover-placeholder.svg')};
 });
 if(['home','category','project','year','projects'].includes(route.page))renderKeepingState()
});

// Remote projects join local demonstrations without replacing their IDs or routes.
window.A45Archive={renderContent:(type,content)=>ProjectPage.content(type,content),preview(project,target){const cat=categoryById.get(project.categoryIds[0]);target.innerHTML=ProjectPage.render(project,cat,'overview');target.querySelector('.project-tabs')?.remove();target.querySelector('.back-link')?.remove();target.querySelector('.project-actions')?.remove();target.querySelector('.project-close')?.remove();const nav=document.createElement('div');nav.className='project-editor-tabs';ProjectTabs.list(project).forEach(tab=>{const b=document.createElement('button');b.type='button';b.textContent=tab.title;b.addEventListener('click',()=>{target.querySelector('.project-panel').innerHTML=ProjectPage.content(tab.type,tab.content)});nav.append(b)});target.prepend(nav)}};
function projectFingerprint(project){return JSON.stringify(project,(key,value)=>{if(typeof value==='string'&&value.includes('/storage/v1/object/sign/')){try{const url=new URL(value);url.searchParams.delete('token');return url.href}catch{}}return value})}
function renderKeepingState(){const top=document.scrollingElement.scrollTop,open=[...document.querySelectorAll('#main .project-read-more')].map(node=>node.open),focus=document.activeElement,focusId=focus?.id,focusTab=focus?.dataset?.projectTab;render();document.querySelectorAll('#main .project-read-more').forEach((node,i)=>node.open=!!open[i]);const target=focusId?document.getElementById(focusId):focusTab?document.querySelector(`[data-project-tab="${CSS.escape(focusTab)}"]`):null;target?.focus({preventScroll:true});document.scrollingElement.scrollTop=top}
window.addEventListener('a45-projects',event=>{const wasLoading=projectsLoading;projectsLoading=false;const previousProject=route.page==='project'?findProject(route.id):null,previousFingerprint=projectFingerprint(previousProject),previous=JSON.stringify(projects.filter(p=>p.cloud&&!p.editorPreview));const local=projects.filter(p=>(window.A45Cloud?.onlineOnly?p.editorPreview:(!p.cloud||p.editorPreview))&&!event.detail.some(remote=>remote.id===p.id)&&!(window.archiveData.projectAliases?.[p.id]&&event.detail.some(remote=>remote.id===window.archiveData.projectAliases[p.id])));const incoming=event.detail.filter(p=>!local.some(x=>x.id===p.id||x.slug===p.slug));const kept=new Set([...local,...incoming]);for(const old of projects)if(!kept.has(old))old.releaseMedia?.();projects.splice(0,projects.length,...local,...incoming);const nextProject=route.page==='project'?findProject(route.id):null;if(previousProject&&nextProject&&previousFingerprint===projectFingerprint(nextProject)){window.dispatchEvent(new CustomEvent('a45-refresh-project-media',{detail:nextProject}));return}if((wasLoading||previous!==JSON.stringify(incoming))&&['category','projects','year','project'].includes(route.page))renderKeepingState()});
window.addEventListener('a45-cloud-error',()=>{if(categoriesLoading){categoriesLoading=false;categoriesError=true;render();if(route.page==='category'&&!categoryById.has(route.id))$('#main').textContent='Не удалось загрузить раздел. Обновите страницу.'}});
window.addEventListener('a45-project-error',()=>{if(projectsLoading){projectsLoading=false;render();const empty=document.querySelector('#main .empty');if(empty)empty.textContent='Не удалось загрузить проекты. Обновите страницу.'}});
window.addEventListener('a45-project-migrated',event=>{const {sourceId,project}=event.detail;projects.splice(0,projects.length,...projects.filter(p=>p.id!==sourceId&&p.id!==project.id),project)});
window.addEventListener('popstate',handleRouteChange);

window.addEventListener("a45-home-change",()=>{if(route.page==='drafts')draftsStatus='idle';categories.forEach(c=>categoryById.set(c.id,c));render()});

window.addEventListener("a45-clear-previews",()=>{projects.splice(0,projects.length,...projects.filter(p=>!p.editorPreview));if(['project','drafts'].includes(route.page)){draftProjects=[];draftsStatus='idle';render()}});

window.addEventListener('a45-drafts-refresh',()=>{if(route.page==='drafts'&&draftsStatus!=='loading'){draftsStatus='idle';renderKeepingState()}});
