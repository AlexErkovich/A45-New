'use strict';
// Appearance only: keep the existing card layout and reuse cards during cloud refreshes.
window.A45Cards=(()=>{
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 const registered=new WeakSet(),shown=new WeakSet(),images=new WeakSet(),skipImageFade=new WeakSet(),pendingImages=new WeakMap();
 let observer=null,pageKey=null;
 function fadeImage(image){if(skipImageFade.delete(image)||motion.matches||typeof image.animate!=='function')return;image.animate([{opacity:.25},{opacity:1}],{duration:320,easing:'ease-out'}).finished?.catch(()=>{})}
 function bindImage(image){if(!image||images.has(image))return;images.add(image);image.addEventListener('load',()=>fadeImage(image))}
 function updateImage(image,src){
  if(!image||!src)return;
  if(image.getAttribute('src')===src){pendingImages.delete(image);return}
  if(pendingImages.get(image)===src)return;
  bindImage(image);
  if(!image.complete||!image.naturalWidth){pendingImages.delete(image);image.src=src;return}
  pendingImages.set(image,src);const next=new Image();
  const loaded=typeof next.decode==='function'?()=>next.decode():()=>new Promise((resolve,reject)=>{next.onload=resolve;next.onerror=reject});
  next.src=src;
  loaded().then(()=>{if(pendingImages.get(image)!==src||!image.isConnected)return;if(image.getAttribute('src').split('?')[0]===src.split('?')[0])skipImageFade.add(image);image.src=src}).catch(()=>{}).finally(()=>{if(pendingImages.get(image)===src)pendingImages.delete(image)});
 }
 function reveal(card,index=0){
  observer?.unobserve(card);if(shown.has(card))return;shown.add(card);card.classList.remove('card-reveal-pending');
  if(motion.matches)return;
  card.style.setProperty('--card-reveal-delay',Math.min(index,5)*55+'ms');card.classList.add('card-reveal-enter');
  card.addEventListener('animationend',event=>{if(event.target===card&&event.animationName==='a45-card-reveal')card.classList.remove('card-reveal-enter')});
 }
 function prepare(root){
  if(!observer&&typeof window.IntersectionObserver==='function')observer=new window.IntersectionObserver(entries=>{let index=0;for(const entry of entries)if(entry.isIntersecting)reveal(entry.target,index++)},{threshold:.08});
  root.querySelectorAll('.card-grid > .card').forEach(card=>{
   bindImage(card.querySelector('img'));if(registered.has(card))return;registered.add(card);
   if(motion.matches||!observer){shown.add(card);return}
   card.classList.add('card-reveal-pending');observer.observe(card);
  });
 }
 function syncCard(card,next){
  for(const selector of ['h2','.card-body p']){const target=card.querySelector(selector),source=next.querySelector(selector);if(target&&source&&target.textContent!==source.textContent)target.textContent=source.textContent}
  const image=card.querySelector('img'),source=next.querySelector('img');if(image&&source){image.alt=source.alt;updateImage(image,source.getAttribute('src'))}
 }
 function render(root,html,key){
  const fragment=document.createElement('template');fragment.innerHTML=html;
  const oldGrid=root.querySelector('.card-grid'),newGrid=fragment.content.querySelector('.card-grid');
  const positions=new Map();
  if(key===pageKey&&oldGrid&&!motion.matches)oldGrid.querySelectorAll(':scope > .card').forEach(card=>{const r=card.getBoundingClientRect();if(shown.has(card)&&!card.classList.contains('card-reveal-enter')&&r.bottom>0&&r.top<window.innerHeight)positions.set(card,r)});
  if(key===pageKey&&oldGrid&&newGrid){
   const previous=new Map([...oldGrid.querySelectorAll(':scope > .card')].map(card=>[card.getAttribute('href'),card]));
   const cards=[...newGrid.children].map(next=>{const existing=previous.get(next.getAttribute('href'));if(!existing)return next;syncCard(existing,next);return existing});
   oldGrid.replaceChildren(...cards);newGrid.replaceWith(oldGrid);
  }else{observer?.disconnect();pageKey=key}
  root.replaceChildren(fragment.content);prepare(root);
  for(const [card,before] of positions){
   if(!card.isConnected||typeof card.animate!=='function')continue;card.a45LayoutAnimation?.cancel();
   const after=card.getBoundingClientRect(),x=before.left-after.left,y=before.top-after.top;
   if(Math.abs(x)+Math.abs(y)<1)continue;
   card.a45LayoutAnimation=card.animate([{translate:x+'px '+y+'px'},{translate:'0 0'}],{duration:400,easing:'cubic-bezier(.2,.7,.2,1)'});card.a45LayoutAnimation.finished?.catch(()=>{});
  }
 }
 motion.addEventListener?.('change',()=>{if(!motion.matches)return;document.querySelectorAll('.card-reveal-pending').forEach(card=>reveal(card));document.querySelectorAll('.card-reveal-enter').forEach(card=>card.classList.remove('card-reveal-enter'))});
 return {render,image:updateImage};
})();
