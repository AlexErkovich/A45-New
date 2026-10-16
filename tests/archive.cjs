// Run: node A45-New/tests/archive.cjs. Verifies logic with a minimal DOM stub.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map(),events={},windowEvents={};
function element(s){if(!elements.has(s)){const classes=new Set();elements.set(s,{innerHTML:'',value:'',attributes:{},inert:false,scrollTop:0,listeners:{},focus(){},classList:{toggle(k,v){if(v??!classes.has(k)){classes.add(k);return true}classes.delete(k);return false},remove(k){classes.delete(k)},contains:k=>classes.has(k)},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},showModal(){},close(){}})}return elements.get(s)}
const ctx={window:{addEventListener(k,fn){windowEvents[k]=fn},matchMedia(){return {matches:false,addEventListener(){}}}},URLSearchParams,location:{hash:'#/',href:'http://127.0.0.1:3000/#/'},document:{body:{style:{}},documentElement:element('html'),scrollingElement:{scrollTop:0},querySelector:element,querySelectorAll:()=>[],addEventListener(k,fn){events[k]=fn}}};vm.createContext(ctx);
for(const f of ['data/projects.js','project-page.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);const render=hash=>{ctx.location.hash=hash;run('render()');return element('#main').innerHTML};
const {categories,projects}=ctx.window.archiveData;
assert.equal(new Set(categories.map(c=>c.id)).size,categories.length);
for(const cat of categories){for(const k of ['id','parentId','title','slug','description','sortOrder'])assert(k in cat);const seen=new Set();for(let c=cat;c;c=categories.find(p=>p.id===c.parentId)){assert(!seen.has(c.id),'cycle');seen.add(c.id);assert(c.parentId===null||categories.some(p=>p.id===c.parentId))}}
for(const p of projects){assert(!('placements' in p));assert(p.categoryIds.length);assert.equal(new Set(p.categoryIds).size,p.categoryIds.length);for(const id of p.categoryIds)assert(categories.some(c=>c.id===id))}
for(const id of ['photography','macro','wildlife','insects']){assert(render('#/category/'+id).includes('Макросъёмка насекомых'));assert(run(`expanded.has('${id}')`))}
assert(!render('#/category/plants').includes('Макросъёмка насекомых'));
assert(render('#/category/plants').includes('ничего не найдено'));
const deep=render('#/category/insects');for(const label of ['Фотография','Макросъёмка','Живая природа','Насекомые'])assert(deep.includes(label));
assert(!element('#archive').innerHTML.includes('data-branch'));assert(element('#archive').innerHTML.includes('class="tree-label"'));assert(element('#archive').innerHTML.includes('>Все проекты</a>'));for(const icon of ['›','⌄','>−<','>+<'])assert(!element('#archive').innerHTML.includes(icon));
function clickCategory(id,extra={}){let prevented=false;events.click({preventDefault(){prevented=true},target:{closest:s=>s==='[data-category]'?{dataset:{category:id}}:null},...extra});return prevented}
// The same interaction works for every existing parent, at every depth.
for(const c of categories.filter(c=>categories.some(child=>child.parentId===c.id))){
 render('#/category/'+c.id);assert(run(`expanded.has('${c.id}')`));
 const before=element('#main').innerHTML,hash=ctx.location.hash;
 assert(clickCategory(c.id));assert(!run(`expanded.has('${c.id}')`));assert(element('#branch-'+c.id).inert);assert.equal(element(`[data-category="${c.id}"]`).attributes['aria-expanded'],'false');
 assert.equal(ctx.location.hash,hash);assert.equal(element('#main').innerHTML,before);
 run('render()');assert(!run(`expanded.has('${c.id}')`),'rerender preserves collapse');
 assert(clickCategory(c.id));assert(run(`expanded.has('${c.id}')`));assert(!element('#branch-'+c.id).inert);
}
render('#/category/beetles');assert(!clickCategory('beetles'));assert(clickCategory('photography'));assert(!run("expanded.has('photography')"));
run('expanded.clear()');assert(!clickCategory('personal-sites'));render('#/category/personal-sites');assert(run("expanded.has('it') && expanded.has('web') && expanded.has('websites')"));assert(element('#archive').innerHTML.includes('data-category="personal-sites" href="#/category/personal-sites" aria-current="page"'));
// Mobile menu uses the same tree and leaves the route and main content intact.
const mobileHash=ctx.location.hash,mobileMain=element('#main').innerHTML;
function clickArchive(){events.click({target:{closest:s=>s==='#archive-toggle'?{}:null}})}
clickArchive();assert(element('#archive').classList.contains('open'));assert.equal(element('#archive-toggle').attributes['aria-expanded'],'true');clickArchive();assert(!element('#archive').classList.contains('open'));assert.equal(ctx.location.hash,mobileHash);assert.equal(element('#main').innerHTML,mobileMain);
const shared=projects.find(p=>p.id==='5-1');for(const id of shared.categoryIds)assert(render('#/category/'+id).includes(shared.title));assert.equal((render('#/projects').match(/<h2>Умная камера/g)||[]).length,1);
render('#/category/insects');const href=run('projectHref(projects[0])');assert(render(href).includes('href="#/category/insects">← Вернуться'));
run("filterState.category='photography';filterState.subcategory='wildlife'");assert(run('matches(projects[0])'));
run("filterState.subcategory='apps'");assert(!run("matches(projects.find(p=>p.id==='5-1'))"));
run("filterState.category='it'");assert(run("matches(projects.find(p=>p.id==='5-1'))"));run("filterState.year='1900'");assert(!run("matches(projects.find(p=>p.id==='5-1'))"));
run("Object.keys(filterState).forEach(k=>filterState[k]='')");
element('[name="category"]').value='photography';run('subOptions()');assert(element('[name="subcategory"]').innerHTML.includes('Насекомые'));assert(!element('[name="subcategory"]').innerHTML.includes('Приложения'));
assert(render('#/category/0/'+encodeURIComponent('Макросъёмка')).includes('<h1>Макросъёмка</h1>'));
for(const p of projects)assert(render('#/project/'+p.id).includes(p.title));assert(render('#/project/5-1?category=missing').includes('← Вернуться: IT-проекты'));
assert.equal((render('#/').match(/class="card"/g)||[]).length,7);
// A new depth needs only data, without a new renderer or route component.
run("categories.push({id:'deeper',parentId:'insects',title:'Новый уровень',slug:'deeper',description:'',sortOrder:0});categoryById.set('deeper',categories[categories.length-1]);projects[0].categoryIds=['deeper']");assert(render('#/category/deeper').includes('Макросъёмка насекомых'));assert(run("expanded.has('insects')"));assert(render('#/category/photography').includes('Макросъёмка насекомых'));
console.log('PASS: hierarchy integrity, recursive deep routes, descendant aggregation, shared projects, deduplication, text-only tree, repeated-name toggle at all depths, mobile tree toggle, filters, legacy links and contextual return.');

// A project attached to multiple descendants in one branch is listed only once.
run("projects[0].categoryIds=['beetles','butterflies','insects']");
assert.equal((render('#/category/photography').match(/<h2>Макросъёмка насекомых<\/h2>/g)||[]).length,1);
for(const c of categories)assert(render('#/category/'+c.id).includes('<h1>'+c.title+'</h1>'));
const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');assert(!css.includes('.tree-row button'));assert(!/\.tree-children\{[^}]*border/.test(css));assert(css.includes('@media(max-width:767px)'));assert(css.includes('.internal #archive.open{display:block}'));assert(css.includes('repeat(5,minmax(0,1fr))'));assert(css.includes('aspect-ratio:4 / 3'));
console.log('PASS: all category routes, same-branch deduplication and unchanged mobile/grid/image CSS.');

// Scrolling and disclosure are independent from routing, even for inactive parents.
render('#/category/beetles');
element('#archive').scrollTop=240;element('#archive').listeners.scroll();ctx.document.scrollingElement.scrollTop=640;
const fixedHash=ctx.location.hash,fixedMain=element('#main').innerHTML;
for(const id of ['photography','macro','wildlife','insects','it','web','websites']){clickCategory(id);assert.equal(ctx.location.hash,fixedHash);assert.equal(ctx.document.scrollingElement.scrollTop,640);assert.equal(element('#archive').scrollTop,240);assert.equal(element('#main').innerHTML,fixedMain)}
ctx.location.hash='#/category/personal-sites';windowEvents.hashchange();assert.equal(ctx.document.scrollingElement.scrollTop,0);assert.equal(element('#archive').scrollTop,240);
assert(run("categoryPath('beetles').length >= 5"));
// Mobile background locks without losing its scroll; reopening restores menu position.
ctx.document.scrollingElement.scrollTop=580;
clickArchive();assert(ctx.document.documentElement.classList.contains('archive-menu-open'));assert.equal(ctx.document.body.style.top,'-580px');assert.equal(element('#archive').scrollTop,240);
clickCategory('web');assert.equal(ctx.document.scrollingElement.scrollTop,580);assert.equal(element('#archive').scrollTop,240);
clickArchive();assert(!ctx.document.documentElement.classList.contains('archive-menu-open'));assert.equal(ctx.document.body.style.top,'');assert.equal(ctx.document.scrollingElement.scrollTop,580);
clickArchive();assert.equal(element('#archive').scrollTop,240);events.keydown({key:'Escape'});assert(!ctx.document.documentElement.classList.contains('archive-menu-open'));
assert(!fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8').includes('window.scrollTo'));
assert(css.includes('position:sticky'));assert(css.includes('overflow-y:auto'));assert(css.includes('overscroll-behavior:contain'));assert(css.includes('html.archive-menu-open body{position:fixed'));
console.log('PASS: 5-level tree, inactive branch disclosure without routing/scroll changes, sidebar position across routes, mobile background lock/reopen/Escape.');
