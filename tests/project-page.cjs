const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),els=new Map(),events={},windowEvents={};let tabElements=[];
function el(key){if(!els.has(key)){const classes=new Set();els.set(key,{innerHTML:'',value:'',scrollTop:0,style:{},dataset:{},attributes:{},listeners:{},classList:{contains:k=>classes.has(k),toggle(k,v){const on=v??!classes.has(k);on?classes.add(k):classes.delete(k);return on},remove(k){classes.delete(k)}},setAttribute(k,v){this.attributes[k]=v},getAttribute(k){return this.attributes[k]},addEventListener(k,fn){this.listeners[k]=fn},getBoundingClientRect(){return {top:-200}},focus(){},showModal(){this.open=true},close(){this.open=false}})}return els.get(key)}
const location={hash:'#/'};Object.defineProperty(location,'href',{get(){return 'http://127.0.0.1:3000/'+this.hash}});
const history={entries:['#/'],scrollRestoration:'auto',pushState(a,b,hash){this.entries.push(hash);location.hash=hash}};
const ctx={location,history,URLSearchParams,window:{innerHeight:800,addEventListener(k,fn){windowEvents[k]=fn},matchMedia:()=>({matches:false,addEventListener(){}})},document:{body:{style:{}},documentElement:el('html'),scrollingElement:{scrollTop:0},querySelector:el,querySelectorAll:s=>s==='[data-project-tab]'?tabElements:[],addEventListener(k,fn){events[k]=fn}}};vm.createContext(ctx);
for(const f of ['data/projects.js','project-page.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);function render(hash){location.hash=hash;run('render()');return el('#main').innerHTML}
const crane=ctx.window.archiveData.projects.find(p=>p.id==='camera-crane');assert(crane);assert.equal(crane.tabs.length,8);assert(crane.categoryIds.includes('film-equipment'));
for(const project of ctx.window.archiveData.projects){const tabs=run(`ProjectTabs.list(findProject('${project.id}'))`);assert.equal(tabs[0].title,project.overviewTitle||'Обзор');assert.equal(new Set(tabs.map(t=>t.id)).size,tabs.length);for(const tab of tabs){const html=render(`#/project/${project.slug}?tab=${tab.id}`);assert(html.includes(`aria-labelledby="tab-${tab.id}"`));assert(html.includes(`id="tab-${tab.id}"`));assert(html.includes('aria-selected="true"'));assert(!html.includes('ИССЛЕДОВАНИЕ ·'));}}
render('#/project/camera-crane?category=technical&tab=history');assert(el('#main').innerHTML.includes('Первые мысленные эксперименты'));
// A tab click pushes a shareable URL without rendering the tree/main again.
const tabs=run('ProjectTabs.list(findProject("camera-crane"))');tabElements=tabs.map(t=>{const a=el('tab-'+t.id);a.dataset.projectTab=t.id;a.attributes.href=run(`ProjectTabs.href(findProject('camera-crane'),{id:'${t.id}'},'technical')`);a.matches=s=>s==='[data-project-tab]';a.click=()=>events.click({preventDefault(){},target:{closest:s=>s==='[data-project-tab]'?a:null}});return a});
el('#archive').scrollTop=270;el('#archive').listeners.scroll();ctx.document.scrollingElement.scrollTop=650;const tree=el('#archive').innerHTML,main=el('#main').innerHTML;
tabElements.find(t=>t.dataset.projectTab==='docs').click();assert(location.hash.includes('tab=docs'));assert(location.hash.includes('category=technical'));assert.equal(el('#archive').scrollTop,270);assert.equal(el('#archive').innerHTML,tree);assert.equal(el('#main').innerHTML,main);assert.equal(ctx.document.scrollingElement.scrollTop,650);assert(el('#project-panel').innerHTML.includes('download'));assert.equal(el('tab-docs').attributes['aria-selected'],'true');
// Back/forward hash events use the same no-scroll tab update path.
for(const id of ['history','docs','overview']){location.hash='#/project/camera-crane?category=technical&tab='+id;windowEvents.hashchange();assert.equal(el('#project-panel').attributes['aria-labelledby'],'tab-'+id);assert.equal(el('#archive').scrollTop,270);assert.equal(ctx.document.scrollingElement.scrollTop,650)}
assert(render('#/project/camera-crane?tab=unknown').includes('aria-labelledby="tab-overview"'));
assert(render('#/project/0-0').includes('Макросъёмка насекомых'));
assert(run('ProjectTabs.list(findProject("0-0"))').some(t=>t.id==='story'));assert(run('ProjectTabs.list(findProject("5-1"))').some(t=>t.id==='development'));
const photoButton={dataset:{projectImage:'assets/crane-1.svg',caption:'Опора'},querySelector:()=>({alt:'Опора'})};let carousel;
const originalQuery=ctx.document.querySelectorAll;ctx.document.querySelectorAll=s=>s==='#project-panel [data-project-image]'?[photoButton]:originalQuery(s);ctx.window.A45PhotoCarousel=options=>carousel=options;ctx.photoButton=photoButton;run('ProjectPage.openImage(photoButton)');assert.equal(carousel.items[0].src,'assets/crane-1.svg');assert.equal(carousel.items[0].caption,'Опора');assert.equal(carousel.id,'0');ctx.document.querySelectorAll=originalQuery;

render('#/project/camera-crane?tab=docs');const share=new URL(run('ProjectPage.shareHref(findProject("camera-crane"))'));assert.equal(share.hostname,'t.me');assert.equal(share.searchParams.get('url'),'http://127.0.0.1:3000/share/camera-crane.html');assert.equal(share.searchParams.get('text'),crane.title);assert(run('buildTelegramPublication(findProject("camera-crane"),location.href)').includes(crane.description));
// Every referenced local image/video/download exists; download byte sizes match.
function inspect(type,c){if(type==='mixed')return c.forEach(b=>inspect(b.type,b.content));if(type==='files')for(const f of c.files){assert.equal(fs.statSync(path.join(root,f.url)).size,f.size);assert(f.size>0)}if(type==='image')assert(fs.existsSync(path.join(root,c.src)));if(type==='gallery')for(const i of c.images)assert(fs.existsSync(path.join(root,i.src)));if(type==='video'){assert(fs.statSync(path.join(root,c.src)).size>0);assert(fs.existsSync(path.join(root,c.poster)))}}
for(const p of ctx.window.archiveData.projects)for(const t of p.tabs)inspect(t.type,t.content);
// Sorting and overview fallback are independent of each project's chosen tab set.
const generic=run("ProjectTabs.list({description:'Test',tabs:[{id:'late',title:'Late',sortOrder:90},{id:'early',title:'Early',sortOrder:1}]})");assert.deepEqual(Array.from(generic,t=>t.id),['overview','early','late']);
console.log('PASS: all project/tab routes, 8 crane tabs, URL/history events, unchanged tree/main scroll, active state, gallery, local downloads/video, Telegram URL/text, variable tab sets and sorting.');

const publication=render('#/project/camera-crane?category=technical');assert(publication.includes('class="project-actions"'));assert(publication.includes('data-copy-project-link'));assert(publication.includes('href="#/category/technical"'));assert(!publication.includes('class="back-link"'));assert(run('ProjectPage.content("divider")').includes('<hr'));

assert(render("#/category/eco").includes("Автоматическая теплица"));const greenhouse=render("#/project/automatic-greenhouse?category=eco");assert(greenhouse.includes("Концепция"));assert(greenhouse.includes("Зачем?"));assert(greenhouse.includes('href="#/category/eco"'));

// Removing the original overview must not create a phantom description-only tab after reload.
const cloudTabs=run("ProjectTabs.list({cloud:true,description:'Card summary',tabs:[{id:'t-idea',title:'Идея',sortOrder:0,type:'mixed',content:[{type:'richtext',content:{text:'Full saved idea'}}]},{id:'t-history',title:'История',sortOrder:1,type:'mixed',content:[]}]})");
assert.deepEqual(Array.from(cloudTabs,t=>t.id),['t-idea','t-history']);
assert.equal(cloudTabs[0].title,'Идея');
assert.equal(cloudTabs[0].content[0].content.text,'Full saved idea');
console.log('PASS: cloud projects preserve real tabs/content without phantom overview after deleting original overview.');
