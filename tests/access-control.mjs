import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {canonicalPath,adminReturnTarget,editorRoute,contextualHref} from '../src/access-routes.mjs';
import {createManagementAccess} from '../src/management-access.mjs';
import {createPublicClient} from '../src/public-client.mjs';
import {createTransferPage} from '../src/transfer-page.mjs';
import {mountAuthForm} from '../src/auth-form.mjs';
import {returnFromLogin} from '../src/session-navigation.mjs';
const origin='https://example.test';
for(const [path,expected] of [
 ['/','/'],['/#/category/eco','/#/category/eco'],['/admin','/admin'],['/#/login?return=x','/login?return=x'],
 ['/project/new?category=eco','/admin#/project/new?category=eco'],['/project/edit/id?tab=photos','/admin#/project/edit/id?tab=photos'],['/transfer','/admin#/transfer'],['/#/drafts','/admin#/drafts']
])assert.equal(canonicalPath(new URL(path,origin)),expected);
for(const unsafe of [null,'https://evil.test','//evil.test','/\\evil.test','/%2f%2fevil.test','/login','/#/login','%%%'])assert.equal(adminReturnTarget(unsafe,origin),'/admin');
assert.equal(adminReturnTarget('/project/edit/id?tab=photos',origin),'/admin#/project/edit/id?tab=photos');
assert.equal(adminReturnTarget('/#/category/eco',origin),'/admin#/category/eco');
assert.equal(editorRoute(new URL('/project/new',origin)),null);
assert.equal(editorRoute(new URL('/admin#/project/edit/id?tab=photos',origin)).params.get('tab'),'photos');
assert.equal(contextualHref('#/category/eco',new URL('/admin',origin)),'/admin#/category/eco');
const config={url:origin,key:'public-key'};let publicOptions;
const publicClient=createPublicClient((url,key,options)=>{assert.equal(url,origin);assert.equal(key,'public-key');publicOptions=options;return {kind:'anonymous'}},config);
assert.equal(publicClient.kind,'anonymous');assert.equal(publicOptions.auth.persistSession,false);assert.equal(publicOptions.auth.autoRefreshToken,false);assert.equal(publicOptions.auth.detectSessionInUrl,false);assert.equal(publicOptions.auth.storageKey,'a45-public-readonly');
const w=new Window({url:origin+'/admin',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
for(const key of ['window','document','location','history','Event'])globalThis[key]=key==='window'?w:w[key];
let allowed=false,failRole=false,roleChecks=0,clears=0,errors=0,rolePromise=null,signoutError=null,signouts=0;
const editor={dirty:false,lock(){}};
const access=createManagementAccess({window:w,authService:{async isAdmin(){roleChecks++;if(failRole)throw Error('Network');return rolePromise||allowed}},client:{auth:{async signOut(){signouts++;return {error:signoutError}}}},projectEditor:editor,onClear(){clears++},onError(){errors++},redirectToLogin(){w.history.replaceState(null,'','/login')}});
await access.authorize();assert.equal(w.location.pathname,'/login');assert.equal(access.active(),false);
// A signed-in non-admin remains denied; no flag is enough to grant server privileges.
w.history.replaceState(null,'','/admin');await access.authorize();assert.equal(access.active(),false);
allowed=true;w.history.replaceState(null,'','/admin');await access.authorize();assert.equal(access.active(),true);
w.history.replaceState(null,'','/');access.leave();assert.equal(access.active(),false);assert.equal(w.A45Management,false);
let resolveRole;rolePromise=new Promise(resolve=>{resolveRole=resolve});w.history.replaceState(null,'','/admin');const pending=access.authorize();w.history.replaceState(null,'','/');access.leave();resolveRole(true);await pending;assert.equal(w.A45Management,false,'late role response cannot enable public management');rolePromise=null;
w.history.replaceState(null,'','/admin');failRole=true;await access.authorize();assert.equal(access.active(),false);assert.equal(errors,1);failRole=false;await access.authorize();assert.equal(access.active(),true);
editor.dirty=true;assert.equal(await access.logout(),false);assert.equal(signouts,0);editor.dirty=false;signoutError=Error('Network');assert.equal(await access.logout(),false);assert.equal(access.active(),true);signoutError=null;assert.equal(await access.logout(),true);assert.equal(w.location.pathname,'/');assert.equal(w.A45Management,false);assert(clears>0);
w.history.replaceState(null,'','/admin');await access.authorize();access.sessionEnded();assert.equal(w.location.pathname,'/login');assert.equal(w.A45Management,false);
// Actual existing Auth form: signInWithPassword + a server role check before navigation.
w.document.body.innerHTML='<main id="main"></main>';let signins=0;allowed=false;
const client={auth:{async signInWithPassword({email,password}){assert.equal(email,'admin@example.test');assert.equal(password,'test-only');signins++;return {error:null}}}};
const service={async isAdmin(){return allowed}};let successes=0;
mountAuthForm({root:w.document.querySelector('main'),client,service,onSuccess(){successes++;returnFromLogin(null)}});
async function submit(){const form=w.document.querySelector('form');form.elements.email.value=' admin@example.test ';form.elements.password.value='test-only';form.dispatchEvent(new w.Event('submit',{cancelable:true}));for(let i=0;i<6;i++)await Promise.resolve()}
await submit();assert.equal(successes,0);assert(w.document.querySelector('[data-admin-status]').textContent.includes('нет прав'));assert.equal(w.location.pathname,'/login');allowed=true;await submit();assert.equal(successes,1);assert.equal(w.location.pathname,'/admin');assert.equal(signins,2);assert.equal(w.document.querySelector('[name=password]').value,'');assert(roleChecks>0);
// A slow local-recovery read or error must not overwrite the public page later.
for(const fails of [false,true]){
 w.history.replaceState(null,'','/admin#/transfer');w.A45Management=true;
 w.document.body.innerHTML='<main id="main"></main>';let finish;
 const delayed=new Promise((resolve,reject)=>{finish=()=>fails?reject(Error('Mock recovery failure')):resolve([])});
 const transfer=createTransferPage({authService:{},projectService:{},refresh(){},storage:{getItem(){return null}},recovery:{list(){return delayed}}});
 const mounting=transfer.mount();w.history.replaceState(null,'','/');w.A45Management=false;w.document.querySelector('main').textContent='Public';finish();await mounting;
 assert.equal(w.document.querySelector('main').textContent,'Public','late transfer response cannot render management on public page');
}
await w.happyDOM.close();console.log('PASS: protected routes, safe login return, Supabase password form/role gate, logout, auth expiry, denied role/network, late auth response, anonymous public client. No network or database.');
