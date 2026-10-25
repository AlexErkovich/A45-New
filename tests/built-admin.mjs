// Actual production scripts + official Supabase SDK. All HTTP and image coding are mocked.
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../dist/',import.meta.url),w=new Window({url:'http://127.0.0.1:3001/',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
w.structuredClone=structuredClone;w.URL.createObjectURL=()=> 'blob:tiny-test';w.URL.revokeObjectURL=()=>{};
const errors=[];w.addEventListener('error',event=>errors.push(event.message));w.addEventListener('unhandledrejection',event=>errors.push(String(event.reason?.message||event.reason)));
let scriptsData,stored=null,uploads=0,commits=0,publicRequests=0,adminRequests=0;
let roleGate=null,roleFailure=false,roleWaiters=0,roleResponses=0,editClicks=0;
const categoryEdits=new Map();
const createdCategories=[];
const id='11111111-1111-4111-8111-111111111111';
const user={id,email:'admin@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const enc=obj=>Buffer.from(JSON.stringify(obj)).toString('base64url');
const accessToken=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:id,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.test';
const row=doc=>({id:doc.id,slug:doc.slug||'p-'+doc.id,title:doc.title,description:doc.description,year:doc.year,primary_category_id:doc.primaryCategoryId,status:doc.status,revision:doc.revision,cover_media_id:doc.coverMediaId,cover_original_id:doc.coverOriginalId,cover_crop:doc.coverCrop,project_categories:doc.categoryIds.map(category_id=>({category_id})),project_tabs:doc.tabs.map((tab,sort_order)=>({id:tab.id,key:tab.key,title:tab.title,sort_order})),project_blocks:doc.tabs.flatMap(tab=>tab.blocks.map((block,sort_order)=>({...block,tab_id:tab.id,sort_order}))),project_media:doc.media.map(m=>({...m,mime_type:m.mimeType,created_at:'2026-01-01T00:00:00Z'}))});
function response(data,status=200){return new w.Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})}
w.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url),headers=new w.Headers(init.headers||input.headers),admin=headers.get('authorization')==='Bearer '+accessToken;
 const method=init.method||'GET',body=typeof init.body==='string'?JSON.parse(init.body):{};
 if(url.pathname==='/auth/v1/token'){assert.equal(body.grant_type,undefined);assert.equal(body.email,user.email);return response({access_token:accessToken,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user})}
 if(url.pathname==='/auth/v1/user')return admin?response(user):response({message:'No session'},401);
 if(url.pathname==='/auth/v1/logout'){assert(admin);return response({})}
 if(url.pathname.startsWith('/rest/')||url.pathname.startsWith('/storage/')){if(admin)adminRequests++;else publicRequests++}
 if(url.pathname==='/rest/v1/rpc/is_a45_admin'){if(roleGate){roleWaiters++;await roleGate;}roleResponses++;if(roleFailure)return response({message:'Mock role unavailable'},503);return response(admin);}
 if(url.pathname==='/rest/v1/rpc/get_a45_navigation')return response({entries:null,revision:0});
 if(url.pathname==='/rest/v1/rpc/create_a45_category'){assert(admin);const c=body.doc;const row={id:c.id,parent_id:c.parentId,title:c.title,description:c.description,slug:c.id,is_published:true,sort_order:99};createdCategories.push(row);return response(row)}
 if(url.pathname==='/rest/v1/categories'){
  if(method==='PATCH'){assert(admin);const key=url.searchParams.get('id').slice(3);const c=scriptsData.categories.find(c=>c.id===key);const result={id:key,parent_id:c.parentId,title:body.title,description:body.description,slug:c.slug,sort_order:c.sortOrder,is_published:true,cover_image_path:null};categoryEdits.set(key,result);return response(result)}
  return response([...scriptsData.categories.map(c=>categoryEdits.get(c.id)||{id:c.id,parent_id:c.parentId,title:c.title,slug:c.slug,description:c.description,sort_order:c.sortOrder,is_published:true}),...createdCategories]);
 }
 if(url.pathname==='/rest/v1/projects'){
  const rows=stored&&(admin||stored.status==='published')?[row(stored)]:[];
  const accept=headers.get('accept')||'';return response(accept.includes('vnd.pgrst.object')?rows[0]:rows);
 }
 if(url.pathname==='/rest/v1/project_media')return response([]);
 if(url.pathname==='/rest/v1/rpc/save_a45_project'){
  assert(admin,'only the authenticated administrative client may save');
  assert.equal(body.expected_revision,stored?.revision||0,'save revision');
  stored=structuredClone({...body.doc,revision:(stored?.revision||0)+1,slug:'p-'+body.doc.id});commits++;
  return response({revision:stored.revision,slug:stored.slug});
 }
 if(url.pathname.startsWith('/storage/v1/object/sign/project-media/'))return response({signedURL:'/object/sign/project-media/mock?token=test'});
 if(url.pathname.startsWith('/storage/v1/object/project-media/')&&method==='POST'){assert(admin);uploads++;return response({Key:'test-upload',Id:id})}
 throw Error('Unexpected mock endpoint: '+method+' '+url.pathname);
};
// Tiny fake worker; no image codec or browser process runs.
w.Worker=class{postMessage(){w.queueMicrotask(()=>{const blob=new w.Blob([new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80])],{type:'image/webp'});this.onmessage({data:{result:{width:1,height:1,thumbnail:blob,content:blob,large:blob}}})})}terminate(){}};
const html=await readFile(new URL('index.html',root),'utf8');const names=[...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)].map(m=>m[1].split('?')[0]);
w.document.write(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,''));
const nativePush=w.history.pushState.bind(w.history);w.history.pushState=(state,title,url)=>nativePush(state,title,new URL(url,w.document.baseURI).href);
const scripts=[];for(const name of names)scripts.push(await readFile(new URL(name,root),'utf8'));
scriptsData=JSON.parse(scripts[names.indexOf('data/projects.js')].replace('window.archiveData = ','').trim().replace(/;$/,''));
if(!scriptsData.categories.some(c=>c.id==='eco'))scriptsData.categories.push({id:'eco',parentId:'technical',slug:'eco',title:'Эко',description:'',sortOrder:2});

w.eval(scripts.join('\n;\n'));
const $=selector=>w.document.querySelector(selector);
async function until(test,label){for(let i=0;i<300;i++){if(test())return;await new Promise(resolve=>setTimeout(resolve,5))}throw Error('Timed out: '+label+'; '+errors.slice(0,3).join('; ')+'; status: '+[...w.document.querySelectorAll('[role=alert],.feedback-popover')].map(node=>node.textContent.slice(0,300)).join(' | ').slice(0,600))}
function go(path){w.history.replaceState(null,'',path);w.dispatchEvent(new w.Event('hashchange'))}
const tools='#home-edit,#home-add,#section-edit,#section-add,[data-nav-add],.card-edit-outline,#home-section-dialog,#project-edit-form';
function publicOnly(){assert.equal($('#management-navigation')===null,true,'no service links in public DOM');assert.equal($(tools)===null,true,'public DOM must have no admin tools');assert.equal(w.A45Management,false)}
function input(selector,value){const field=$(selector);assert(field,selector);field.value=value;field.dispatchEvent(new w.Event('input',{bubbles:true}))}
function submit(selector){$(selector).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}))}
try{
 assert(w.A45Cloud.configured,'built test requires configured public Supabase settings');await until(()=>$('[data-category-card]'),'public categories');publicOnly();
 go('/admin');await until(()=>$('#admin-login-form'),'anonymous admin redirects');assert.equal(w.location.pathname,'/login');publicOnly();
 input('[name=email]',user.email);input('[name=password]','test-password');submit('#admin-login-form');
 await until(()=>w.location.pathname==='/admin'&&$('#home-add'),'authenticated admin home');assert.equal(w.A45Management,true);
 w.addEventListener('click',event=>{if(event.target.closest('#home-edit'))editClicks++},true);
 // A real click must be handled only once, after the asynchronous role check.
 let releaseRole;roleGate=new Promise(resolve=>{releaseRole=resolve});
 $('#home-edit').click();const changedBeforeRole=$('#home-edit').getAttribute('aria-pressed')==='true';
 await until(()=>roleWaiters===1,'role request is held pending');
 assert.equal($('#home-edit').getAttribute('aria-pressed'),'false','mode must remain unchanged while role RPC is pending');
 releaseRole();roleGate=null;
 assert.equal(changedBeforeRole,false,'home edit must wait for access check; capture handlers must not toggle it before approval');
 await until(()=>$('#home-edit').getAttribute('aria-pressed')==='true','edit mode survives role response');
 assert(w.document.body.classList.contains('home-section-editing'));assert.equal(editClicks,1,'one original click; role approval must not synthesize another');
 function footerOnly(){const nav=$('#management-navigation');assert(nav&&nav.parentElement.tagName==='FOOTER','service navigation belongs in footer');assert.equal(w.document.querySelectorAll('#management-navigation').length,1);assert.equal(w.document.querySelectorAll('.header [data-admin-logout],.header a[href="/admin#/drafts"],.header a[href="/admin#/transfer"],.header [data-public-site]').length,0);assert.equal(nav.querySelectorAll('a').length,4);assert.equal(nav.querySelector('[data-public-site]').getAttribute('href'),'/');assert($('#home-edit')?.closest('.header')||$('#section-edit')?.closest('.header')||$('#project-edit-form'),'edit toolbar stays in header/canvas')}
 footerOnly();
 // Explicit rerenders and a completed async category refresh must retain the mode.
 go('/admin');assert(w.document.body.classList.contains('home-section-editing'));assert.equal($('#home-edit').getAttribute('aria-pressed'),'true');
 categoryEdits.set('photography',{id:'photography',parent_id:null,title:'Refreshed category',description:'Refreshed description',slug:'photography',sort_order:0,is_published:true});
 await w.A45Cloud.retryCategories();assert(w.document.body.classList.contains('home-section-editing'));assert.equal($('#home-edit').getAttribute('aria-pressed'),'true');assert($('[data-category-card=photography] .card-edit-outline'));
 $('[data-category-card=photography]').click();await until(()=>$('#home-section-dialog')?.open,'edit refreshed category');
 input('#home-section-dialog [name=title]','Edited category');input('#home-section-dialog [name=description]','Edited description');submit('#home-section-form');
 await until(()=>!$('#home-section-dialog')?.open,'save category without leaving edit mode');assert(w.document.body.classList.contains('home-section-editing'));assert.equal($('#home-edit').getAttribute('aria-pressed'),'true');assert.equal(categoryEdits.get('photography').title,'Edited category');footerOnly();
 $('#home-edit').click();await until(()=>$('#home-edit').getAttribute('aria-pressed')==='false','explicit Done');
 go('/admin#/category/eco');await until(()=>$('#section-add'),'contextual add');footerOnly();
 $('#section-edit').click();await until(()=>$('#section-edit').getAttribute('aria-pressed')==='true','listing edit enabled');
 go('/admin#/category/eco');assert(w.document.body.classList.contains('listing-editing'));assert.equal($('#section-edit').getAttribute('aria-pressed'),'true');
 $('#section-edit').click();await until(()=>$('#section-edit').getAttribute('aria-pressed')==='false','listing Done');
 // A redraw while role approval is pending must not lose the accepted action.
 let releaseListingRole;roleGate=new Promise(resolve=>{releaseListingRole=resolve});const repliesBefore=roleResponses;
 const clickedToolbar=$('#section-edit');clickedToolbar.click();await until(()=>roleWaiters===2,'pending listing role');
 categoryEdits.set('photography',{...categoryEdits.get('photography'),title:'Audit role refresh'});
 await w.A45Cloud.retryCategories();assert.equal(clickedToolbar.isConnected,false,'fixture replaced the toolbar');releaseListingRole();roleGate=null;
 await until(()=>roleResponses>repliesBefore&&$('#section-edit').getAttribute('aria-pressed')==='true','accepted action survives toolbar replacement');
 go('/admin#/category/photography');assert.equal($('#section-edit').getAttribute('aria-pressed'),'true');
 $('#archive .menu-block-title[data-category="technical"]').click();
 assert.equal(w.location.pathname,'/admin','native History/base resolution must not leave management');assert.equal(w.A45Management,true);assert.equal($('#section-edit').getAttribute('aria-pressed'),'true');
 const nested=$('#archive a[data-category="eco"]');assert(nested);const nestedUrl=new URL(nested.href);assert.equal(nestedUrl.pathname,'/admin');go(nestedUrl.pathname+nestedUrl.hash);
 assert.equal(w.A45Management,true);assert.equal($('#section-edit').getAttribute('aria-pressed'),'true');

 go('/admin#/category/eco');assert.equal($('#section-edit').getAttribute('aria-pressed'),'true');
 $('#section-edit').click();await until(()=>$('#section-edit').getAttribute('aria-pressed')==='false','explicit Done after transitions');
 $('#section-add').click();
 await until(()=>$('#home-section-dialog')?.open,'project card dialog');input('#home-section-dialog [name=title]','SDK integration project');submit('#home-section-form');
 await until(()=>stored?.status==='published'&&w.location.hash.startsWith('#/project/'),'create published project');assert.equal(stored.title,'SDK integration project');assert.equal(w.location.pathname,'/admin');
 await until(()=>$('#section-edit')?.dataset.editProject===stored.id,'created project view');$('#section-edit').click();await until(()=>$('#project-edit-form'),'existing project editor');input('[name=title]','Edited integration project');
 $('[data-menu="block"][data-id="end"]').click();$('[data-command=insert][data-type=TEXT]').click();input('[data-block][data-field=text]','Text from authenticated editor');
 $('[data-menu=tab]').click();$('[data-command=add-tab]').click();input('[name=tabTitle]','Фотографии');submit('[data-tab-form]');
 const png=new w.File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')],'tiny.png',{type:'image/png'});
 const picker=$('[data-upload=tab]');Object.defineProperty(picker,'files',{value:[png]});picker.dispatchEvent(new w.Event('change',{bubbles:true}));
 await until(()=>uploads===4&&$('[aria-label="Фотография загружена"]'),'one original and three staged variants');
 submit('#project-edit-form');await until(()=>!$('#project-edit-form')&&$('#section-edit')?.dataset.editProject===stored.id,'save text and photo');
 assert.equal(stored.title,'Edited integration project');assert(stored.tabs.some(tab=>tab.blocks.some(block=>block.content.text==='Text from authenticated editor')));assert.equal(stored.media.length,1);assert.equal(uploads,4);assert(commits>=3);
 $('#section-edit').click();await until(()=>$('#project-edit-form'),'reopen saved project');assert.equal($('[name=title]').value,'Edited integration project');
 assert(w.A45Cloud.projectEditor.doc.media.length===1,'saved image survives hydration');
 go('/');publicOnly();assert.equal(w.location.pathname,'/');assert(adminRequests>0);assert(publicRequests>0);
 go('/admin');await until(()=>$('#home-add'),'retained real SDK session grants admin');footerOnly();
 roleFailure=true;$('#home-edit').click();await until(()=>$('.feedback-popover')?.textContent.includes('Не удалось проверить доступ'),'role error is reported');assert.equal($('#home-edit').getAttribute('aria-pressed'),'false','a failed role check cannot enable editing');roleFailure=false;
 $('[data-admin-logout]').click();await until(()=>w.location.pathname==='/'&&!w.A45Management,'logout to public');publicOnly();
 assert.equal(errors.length,0,'built runtime errors');
 console.log('PASS: actual production bundle and official SDK; / public, /login, protected /admin, password login, single edit toggle after role check, refresh/save stability, footer-only service links, create project, edit text, one tiny mocked photo/four uploads, Save/reopen, public view with retained admin session, logout. All HTTP/codecs mocked.');
}finally{await w.happyDOM.close()}
