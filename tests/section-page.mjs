import * as accessRoutes from '../src/access-routes.mjs';
import * as sharedUI from '../src/ui/components.mjs';
import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const win=new Window({url:'http://localhost/admin'});
win.A45UI=sharedUI;win.A45Management=true;win.A45Routes=accessRoutes;
win.matchMedia=query=>({matches:query.includes('prefers-reduced-motion'),addEventListener(){}});
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
win.document.write(html);
win.eval(['data/projects.js','project-page.js','feedback.js','home-page.js','app.js'].map(file=>readFileSync(new URL('../'+file,import.meta.url),'utf8')).join('\n;\n'));
const $=s=>win.document.querySelector(s);
assert.equal($('#layout').classList.contains('internal'),false);
assert.equal($('#section-actions').hidden,true);
win.location.hash='#/category/macro';
win.dispatchEvent(new win.HashChangeEvent('hashchange'));
assert(win.document.body.classList.contains('archive-page'));
assert.equal($('#home-actions').hidden,true);
assert.equal($('#section-actions').hidden,false);
assert.equal($('.section-add').dataset.parentCategory,'macro');
assert($('#archive [aria-current="page"]').textContent.includes('Макросъемка'));
assert.equal($('#branch-photography').hidden,false,'active ancestor opens on direct category entry');
assert([...win.document.querySelectorAll('.menu-block-items')].filter(branch=>branch.id!=='branch-photography').every(branch=>branch.hidden));
assert.equal($('#branch-photography').hidden,false);
$('#archive [data-category="photography"]').click();
assert.equal(win.location.hash,'#/category/photography');
assert.equal($('.section-add').dataset.parentCategory,'photography');
assert($('#main .card').getAttribute('href').includes('category=photography'));
assert.equal($('#branch-photography').inert,true);
assert.equal($('#branch-photography').hidden,true);
$('#archive [data-menu-block="photography"]').click();
assert.equal($('#branch-photography').hidden,false);
assert.equal(win.location.hash,'#/category/photography');
$('#archive [data-category="video"]').click();
assert.equal(win.location.hash,'#/category/video');
assert.equal($('#branch-video').hidden,false);
assert.equal($('.section-add').dataset.parentCategory,'video');
$('#archive [data-category="video"]').click();
assert.equal($('#branch-video').hidden,true);
const blocks=[...win.document.querySelectorAll('.menu-block')];
assert.deepEqual(blocks.slice(0,4).map(b=>b.querySelector('h2').textContent),['Фотография','Видео','Техническое творчество','Педагогика']);
assert.deepEqual([...win.document.querySelectorAll('.menu-item')].slice(0,13).map(a=>a.textContent),['Предметная фотография','Репортажная','Макросъемка','Студийная','Пленочные проекты','Свадебная съемка','Монтаж','Репортаж','Ардуино','Кинооператорское оборудование','Эко','Методические разработки','Проекты']);
assert(!$('#archive').textContent.includes('Все проекты'));
for(const section of win.A45Home.sections(null))assert($('#archive [data-menu-category="'+section.id+'"]'),section.title);

for(const link of win.document.querySelectorAll('.menu-item')){
 const hash=link.getAttribute('href');win.location.hash=hash;win.dispatchEvent(new win.HashChangeEvent('hashchange'));
 assert.equal($('#archive .menu-item[aria-current="page"]').getAttribute('href'),hash);
 assert.equal($('.section-add').dataset.parentCategory,hash.split('/').at(-1));
 assert(!$('#main').textContent.includes('Страница не найдена'));
}
win.location.hash='#/category/macro';win.dispatchEvent(new win.HashChangeEvent('hashchange'));
assert($('#main .card').getAttribute('href').includes('category=macro'));
const homeSections=win.A45Home.sections;
win.A45Home.sections=()=>homeSections(null).filter(c=>c.id!=='pedagogy').concat({id:'replacement-pedagogy',title:'Педагогика',parentId:null});
win.archiveData.categories.push({id:'replacement-pedagogy',title:'Педагогика',parentId:null,slug:'replacement-pedagogy',description:'',sortOrder:99});
win.dispatchEvent(new win.Event('a45-home-change'));
assert.equal([...win.document.querySelectorAll('.menu-block-title')].filter(b=>b.textContent==='Педагогика').length,1);
$('#archive [data-menu-block="pedagogy"]').click();
assert.equal(win.location.hash,'#/category/replacement-pedagogy');
win.A45Home.sections=homeSections;
win.location.hash='#/';win.dispatchEvent(new win.HashChangeEvent('hashchange'));
assert.equal($('#section-actions').hidden,true);
assert.equal($('#home-actions').hidden,false);
assert.equal($('#layout').classList.contains('internal'),false);
// Opening a section closes all other sections, including their interaction state.
win.location.hash='#/category/photography';win.dispatchEvent(new win.HashChangeEvent('hashchange'));
$('#archive [data-category="photography"]').click();
$('#archive [data-category="technical"]').click();
assert.equal(win.document.querySelectorAll('#archive [data-open="true"]').length,1);
assert.equal($('#branch-photography').hidden,true);assert.equal($('#branch-photography').inert,true);
assert.equal($('#archive [data-category="photography"]').getAttribute('aria-expanded'),'false');
assert.equal($('[data-menu-block="technical"]').dataset.open,'true');
// Animated disclosure preserves its DOM while the category route changes.
win.location.hash='#/category/photography';win.dispatchEvent(new win.HashChangeEvent('hashchange'));
win.matchMedia=()=>({matches:false,addEventListener(){}});
const branch=$('#branch-video'),menu=$('#archive .category-tree');
const animations=[];
branch.animate=(frames,options)=>{const animation={cancel(){},onfinish:null};animations.push({frames,options,animation});return animation};
const video=$('#archive [data-category="video"]');
video.click();
assert.equal($('#archive .category-tree'),menu);
assert.equal($('#branch-video'),branch);
assert.equal(animations.at(-1).options.duration,320);
assert.equal(branch.inert,false);
animations.at(-1).animation.onfinish();
video.click();
assert.equal(animations.at(-1).options.duration,320);
assert.equal(branch.inert,true);
animations.at(-1).animation.onfinish();
assert.equal(branch.hidden,true);
// Clicking a section aligns it inside the navigation, without scrolling the document.
const archive=$('#archive'),technical=$('[data-menu-block="technical"]');
Object.defineProperty(archive,'clientHeight',{value:600,configurable:true});
Object.defineProperty(technical,'offsetHeight',{value:140,configurable:true});
archive.getBoundingClientRect=()=>({top:112});technical.getBoundingClientRect=()=>({top:480-archive.scrollTop});
let smoothScroll;archive.scrollTo=options=>{smoothScroll=options;archive.scrollTop=options.top};
archive.scrollTop=100;
$('#archive [data-category="technical"]').click();
assert.equal(archive.scrollTop,356);
assert.equal(smoothScroll.behavior,'smooth');
assert.equal(technical.dataset.active,'true');
archive.scrollTop=410;archive.dispatchEvent(new win.Event('scroll'));
win.location.hash='#/project/camera-crane?category=technical';win.dispatchEvent(new win.HashChangeEvent('hashchange'));
assert.equal(archive.scrollTop,410,'project navigation preserves the menu position');
assert.equal($('.project-close').getAttribute('href'),'#/category/technical');
assert.equal($('.project-actions').open,false);

$('.project-close').click();await win.happyDOM.whenAsyncComplete();
assert.equal(win.location.hash,'#/category/technical');
assert.equal(archive.scrollTop,410);
win.location.hash='#/project/0-0?category=macro';win.dispatchEvent(new win.HashChangeEvent('hashchange'));
assert.equal($('.project-close').getAttribute('href'),'#/category/macro','close returns to the actual subsection');
console.log('PASS: section header, exact add-project context, active subsection, block disclosure with root project navigation, project context, return home.');

// Long project text keeps an introduction visible and discloses the remainder natively.
win.location.hash='#/project/automatic-greenhouse?category=eco';
win.dispatchEvent(new win.HashChangeEvent('hashchange'));
const continuation=$('.project-read-more');
assert(continuation);
assert.equal(continuation.open,false);
assert.equal($('#project-panel').querySelectorAll(':scope > .project-prose p').length,3);
assert(continuation.textContent.includes('Зачем?'));
assert(continuation.textContent.includes('Собственно, с этого и началась история'));
continuation.open=true;
assert.equal(continuation.open,true);
assert(continuation.lastElementChild.matches('[data-collapse-project]'),'collapse follows the complete article');
continuation.querySelector('[data-collapse-project]').click();
assert.equal(continuation.open,false);
assert.equal(win.document.activeElement,continuation.querySelector('summary'));
win.location.hash='#/project/automatic-greenhouse?category=eco&tab=photos';
win.dispatchEvent(new win.HashChangeEvent('hashchange'));
assert.equal($('.project-read-more'),null,'short tabs need no disclosure');
win.location.hash='#/project/automatic-greenhouse?category=eco';
win.dispatchEvent(new win.HashChangeEvent('hashchange'));
assert.equal($('.project-read-more').open,false,'returning to a tab starts with the introduction');
console.log('PASS: long project introduction, full continuation, native disclosure and short tabs.');

// Section editing selects a card first; it does not open a modal immediately.
win.location.hash='#/category/eco';win.dispatchEvent(new win.HashChangeEvent('hashchange'));
assert.equal($('#section-edit').dataset.editListing,'eco');
$('#section-edit').click();
assert.equal(win.location.hash,'#/category/eco');assert(win.document.body.classList.contains('listing-editing'));
assert(!$('#home-section-dialog')?.open);
assert($('#main [data-project-card="automatic-greenhouse"] .card-edit-outline'));
$('#section-edit').click();assert(!win.document.body.classList.contains('listing-editing'));
$('#section-edit').click();
$('#main [data-project-card="automatic-greenhouse"]').click();
assert.equal(win.location.hash,'#/category/eco');assert(win.document.body.classList.contains('listing-editing'));assert($('#home-section-dialog').open);assert.equal($('#home-section-dialog [name=title]').value,'Автоматическая теплица');assert.equal($('#home-section-dialog [name=description]').value,win.archiveData.projects.find(p=>p.id==='automatic-greenhouse').description);$('#home-section-dialog').close();$('#section-edit').click();
win.history.replaceState(null,'','/admin#/category/eco');win.dispatchEvent(new win.HashChangeEvent('hashchange'));
assert.equal($('#section-edit').getAttribute('aria-pressed'),'false');
assert.equal($('#visual-controls'),null);win.location.hash='#/project/automatic-greenhouse?category=eco';win.dispatchEvent(new win.HashChangeEvent('hashchange'));$('#section-edit').click();assert.equal(win.location.pathname,'/admin');assert.equal(win.location.hash,'#/project/edit/automatic-greenhouse?tab=overview');


win.history.replaceState(null,'','/admin#/');win.A45Management=true;win.A45Routes=accessRoutes;win.dispatchEvent(new win.HashChangeEvent('hashchange'));
// Recreating a root must not hide projects still attached to its original ID.
const duplicateRoot={id:'technical-recreated',parentId:null,title:'Техническое творчество',slug:'technical-recreated',sortOrder:99,custom:true};
win.archiveData.categories.push(duplicateRoot,{id:'new-technical-child',parentId:duplicateRoot.id,title:'Новый подраздел',slug:'new-technical-child',sortOrder:0,custom:true});
win.archiveData.projects.push({...win.archiveData.projects[0],id:'new-technical-project',slug:'new-technical-project',categoryIds:['new-technical-child']});
win.dispatchEvent(new win.Event('a45-home-change'));
for(const root of ['technical','technical-recreated']){
 win.location.hash='#/category/'+root;win.dispatchEvent(new win.HashChangeEvent('hashchange'));
 assert($('#main [data-project-card="camera-crane"]'),'original projects remain reachable from '+root);
 assert($('#main [data-project-card="new-technical-project"]'),'new descendant projects remain reachable from '+root);
 assert($('#main [data-category-card="new-technical-child"]'),'children remain reachable from '+root);
}
win.location.hash='#/category/photography';win.dispatchEvent(new win.HashChangeEvent('hashchange'));
assert(!$('#main [data-project-card="new-technical-project"]'),'unrelated roots stay isolated');
console.log('PASS: duplicate roots aggregate both project trees without changing stored IDs or unrelated sections.');

// The homepage and move picker must expose exactly the designed navigation.
win.location.hash='#/';win.dispatchEvent(new win.HashChangeEvent('hashchange'));
const navRoots=win.A45Navigation.categories().filter(c=>c.parentId===null).map(c=>c.id);
assert.deepEqual(navRoots,win.A45Home.sections(null).map(c=>c.id));
const destinations=win.A45Navigation.categories();
for(const old of ['drawing','graphics-3d','wildlife','devices','articles','web','film-equipment'])assert(!destinations.some(c=>c.id===old),'legacy destination removed: '+old);
for(const current of ['technical','eco','studio-photo','film-photo','pedagogy'])assert(destinations.some(c=>c.id===current),'current destination retained: '+current);
assert.equal(destinations.filter(c=>c.title==='Техническое творчество'&&c.parentId===null).length,1);
console.log('PASS: homepage and placement picker share current navigation, without legacy roots/children or duplicate technical roots.');
win.location.hash='#/category/camera-equipment';win.dispatchEvent(new win.HashChangeEvent('hashchange'));assert($('#main [data-project-card="camera-crane"]'),'legacy crane remains in current camera-equipment subsection');
// Custom child deletion updates the actual menu as well as picker/card lists.
const removedId='section-custom-delete';win.archiveData.categories.push({id:removedId,parentId:'photography',title:'цу',custom:true,slug:removedId,sortOrder:99});win.dispatchEvent(new win.Event('a45-home-change'));
assert($('#archive [data-category="'+removedId+'"]'));
win.A45Home.open(removedId,{kind:'subcategory',parentId:'photography'});$('#home-section-dialog [data-home-delete]').click();$('[data-feedback-action="delete"]').click();await win.happyDOM.whenAsyncComplete();
assert(!$('#archive [data-category="'+removedId+'"]'));assert(!win.A45Navigation.categories().some(c=>c.id===removedId));
win.dispatchEvent(new win.HashChangeEvent('hashchange'));assert(!$('#archive [data-category="'+removedId+'"]'),'rerender cannot re-add a deleted child');
// Inline plus creates a child of the clicked section without changing the route.
const beforeAdd=win.location.hash;$('#archive [data-nav-add="video"]').click();assert.equal(win.location.hash,beforeAdd);assert($('#home-section-dialog').open);assert.equal($('#home-section-dialog').getAttribute('aria-label'),'Новый подраздел');assert($('#home-section-dialog .home-creation-context').textContent.includes('Видео'));$('#home-section-dialog').close();
console.log('PASS: custom child deletion synchronizes navigation/picker and header plus opens the correct parent.');
await win.happyDOM.close();
