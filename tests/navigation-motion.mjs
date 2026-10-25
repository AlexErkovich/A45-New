import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import * as ui from '../src/ui/components.mjs';
import * as routes from '../src/access-routes.mjs';

const w=new Window({url:'http://localhost/admin'}),listeners=[];
const media={matches:false,addEventListener(type,listener){if(type==='change')listeners.push(listener)}};
w.matchMedia=()=>media;w.A45UI=ui;w.A45Routes=routes;w.A45Management=true;
w.A45Cloud={start(){},projectEditor:{beforeRouteChange(){return true}},releaseImage(){}};
w.document.write(readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,''));
const animations=[];
w.Element.prototype.animate=function(frames,options){
 let resolve,reject;
 const animation={target:this,frames,options,cancelled:false,finished:new Promise((yes,no)=>{resolve=yes;reject=no}),cancel(){this.cancelled=true;reject(Error('Expected animation cancellation'))},finish(){resolve();this.onfinish?.()}};
 animations.push(animation);return animation;
};
w.eval(['data/projects.js','project-page.js','feedback.js','home-page.js','app.js'].map(name=>readFileSync(new URL('../'+name,import.meta.url),'utf8')).join('\n;\n'));
const $=selector=>w.document.querySelector(selector);
const go=id=>{w.history.replaceState(null,'','/admin#/category/'+id);w.dispatchEvent(new w.Event('hashchange'))};
try{
 go('technical');
 const technical=$('#branch-technical'),opening=technical.a45Animation;
 assert.equal(opening.options.duration,320);assert.equal(opening.options.easing,'cubic-bezier(.4,0,.2,1)');assert.equal(technical.hidden,false);assert.equal(technical.inert,false);
 const routeAnimation=$('#main').a45RouteAnimation;
 assert.equal(routeAnimation.options.duration,300);assert.equal(routeAnimation.frames[0].opacity,.85);
 opening.finish();
 $('#archive [data-category="photography"]').click();
 assert.equal(technical.a45Animation,null);assert.equal(technical.hidden,true,'preceding branch settles before measuring the selected block');assert.equal(technical.inert,true);
 const photography=$('#branch-photography'),firstOpening=photography.a45Animation;
 $('#archive [data-category="photography"]').click();
 assert.equal(firstOpening.cancelled,true,'rapid reversal cancels previous motion');assert.equal(photography.a45Animation.options.duration,320);
 $('#archive [data-category="photography"]').click();
 photography.a45Animation.finish();
 const count=animations.length;
 go('photography');assert.equal(animations.length,count,'same route and open branch do not replay');
 media.matches=true;listeners.forEach(listener=>listener({matches:true}));
 assert.equal(photography.a45Animation,null);assert.equal(photography.hidden,false);
 const reducedCount=animations.length;
 go('technical');assert.equal(animations.length,reducedCount,'reduced motion changes state without animating');assert.equal(technical.hidden,false);assert.equal(photography.hidden,true);
 await new Promise(resolve=>setImmediate(resolve));
 // Scroll measurement uses the final route geometry and the visible header boundary.
 const archive=$('#archive'),block=$('[data-menu-block="technical"]'),requests=[];
 $('.header').getBoundingClientRect=()=>({bottom:112});
 archive.getBoundingClientRect=()=>({top:66});
 let blockTop=200;block.getBoundingClientRect=()=>({top:blockTop});
 media.matches=false;archive.scrollTop=100;archive.dispatchEvent(new w.Event('scroll'));archive.scrollTo=options=>{requests.push(options.top);archive.scrollTop=options.top};
 media.matches=false;
 $('#archive [data-category="technical"]').click();
 $('#archive [data-category="technical"]').click();
 blockTop=230;
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests.length,1,'superseded pin requests do not compete');
 assert.equal(requests[0],206,'final geometry aligns below header even when sticky sidebar rises');
 console.log('PASS: automatic/manual 320ms disclosure, stable preceding-branch layout, interruption cleanup, no same-route replay, 300ms route fade and live reduced-motion cancellation. DOM/animations mocked; no browser/network.');
}finally{await w.happyDOM.close()}
