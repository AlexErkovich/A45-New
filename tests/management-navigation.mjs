import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import {renderManagementNavigation,clearManagementNavigation} from '../src/ui/components.mjs';
const w=new Window({url:'https://example.test/admin',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}}),document=w.document;
document.body.innerHTML='<header class="header"><button id="home-edit">Редактировать</button></header><footer><span>Личный архив</span></footer>';
for(const name of ['design-tokens.css','styles.css','ui.css','admin.css']){const style=document.createElement('style');style.textContent=readFileSync(new URL('../'+name,import.meta.url),'utf8');document.head.append(style)}
let exits=0;
renderManagementNavigation({document,active:false});assert.equal(document.querySelector('#management-navigation')===null,true);
for(const page of ['home-page','archive-page','project-editor-route','project-canvas-open']){
 document.body.className=page;
 renderManagementNavigation({document,active:true,onLogout(){exits++}});
 renderManagementNavigation({document,active:true,onLogout(){exits++}});
 const nav=document.querySelector('#management-navigation'),footer=document.querySelector('footer');
 assert.equal(document.querySelectorAll('#management-navigation').length,1,'no duplicate navigation');assert(nav.parentElement===footer);
 assert.notEqual(w.getComputedStyle(footer).display,'none',page+': footer must not inherit page-level hiding');assert.equal(w.getComputedStyle(nav).flexWrap,'wrap');
 assert.equal(nav.querySelectorAll('a').length,4);assert(nav.querySelector('a[href="/admin#/about"]'));assert(nav.querySelector('a[href="/admin#/drafts"]'));assert(nav.querySelector('a[href="/admin#/transfer"]'));assert(nav.querySelector('a[href="/"][data-public-site]'));
 nav.querySelector('[data-admin-logout]').click();assert(document.querySelector('#home-edit').parentElement.classList.contains('header'));
}
assert.equal(exits,4,'one logout callback per click despite repeated render');
clearManagementNavigation({document});assert.equal(document.querySelector('#management-navigation')===null,true);assert.equal(document.querySelector('footer').classList.contains('has-management-navigation'),false);
await w.happyDOM.close();console.log('PASS: one compact footer navigation across admin pages, links and logout intact, CSS does not hide it, cleanup removes links, edit toolbar stays in header. No browser/network.');
