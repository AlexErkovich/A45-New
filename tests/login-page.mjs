import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import {mountAuthForm} from '../src/auth-form.mjs';

const w=new Window({url:'http://localhost/login',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
w.document.write('<main></main>');
for(const name of ['design-tokens.css','styles.css','admin.css','ui.css']){
 const style=w.document.createElement('style');style.textContent=read(name);w.document.head.append(style);
}
w.eval(read('feedback.js'));
let release,calls=0,roles=0,successes=0;
mountAuthForm({root:w.document.querySelector('main'),client:{auth:{signInWithPassword(){calls++;return new Promise(resolve=>{release=resolve})}}},service:{async isAdmin(){roles++;return true}},onSuccess(){successes++}});
const form=w.document.querySelector('form'),button=form.querySelector('button'),status=form.querySelector('[data-admin-status]');
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
const submit=()=>{form.elements.email.value='admin@example.test';form.elements.password.value='test-password';button.click()};
const metrics=()=>{const s=w.getComputedStyle(button);return [s.height,s.padding,s.fontSize,s.borderRadius,s.width].join('|')};
try{
 const initial=metrics();
 assert.equal(w.getComputedStyle(button).marginTop,'20px');
 assert.equal(status.hasAttribute('data-feedback-inline'),true);
 submit();await tick();
 assert.equal(calls,1);assert.equal(button.disabled,true);assert.equal(button.getAttribute('aria-busy'),'true');
 assert.equal(w.getComputedStyle(button).opacity,'1');assert.equal(metrics(),initial);
 assert.equal(status.textContent,'Проверяем вход…');
 assert.equal(w.document.querySelector('.feedback-popover')===null,true);
 assert.equal(button.hasAttribute('data-feedback-tone'),false);assert.equal(button.hasAttribute('aria-invalid'),false);
 release({error:{code:'invalid_credentials'}});await tick();
 assert.equal(button.disabled,false);assert.equal(button.hasAttribute('aria-busy'),false);
 assert.equal(status.textContent,'Не удалось войти. Проверьте email и пароль');
 assert.equal(w.getComputedStyle(status).position,'static');assert.equal(status.previousElementSibling===button,true);
 assert.equal(w.document.querySelector('.feedback-popover')===null,true);assert.equal(metrics(),initial);assert.equal(roles,0);
 button.focus();assert.equal(w.document.activeElement===button,true);
 submit();await tick();assert.equal(status.classList.contains('error'),false);
 release({error:null});await tick();assert.equal(calls,2);assert.equal(roles,1);assert.equal(successes,1);assert.equal(button.disabled,false);assert.equal(metrics(),initial);
 const css=read('admin.css');
 assert(css.includes('body:has(.auth-shell){background:var(--palette-neutral-21)}'));
 assert(css.includes('.ui-button.ui-button:is(:active,:disabled){--button-background:var(--button-fill)}'));
 assert(css.includes('.ui-button.ui-button:focus-visible{outline:2px solid var(--ui-accent);outline-offset:3px}'));
 console.log('PASS: login inline loading/error/retry, one Auth request per submit, unchanged role gate, fixed button geometry/opacity, keyboard focus and scoped active/focus rules; no feedback popup or error marking. HTTP mocked; native hover/paint not exercised.');
}finally{await w.happyDOM.close()}
