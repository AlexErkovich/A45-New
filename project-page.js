'use strict';
// Shared, data-driven publication components. Content is plain text, not executable HTML.
const FileList={
 size(bytes){return bytes<1024?`${bytes} Б`:bytes<1048576?`${(bytes/1024).toFixed(1)} КБ`:`${(bytes/1048576).toFixed(1)} МБ`},
 render(files=[]){return files.length?`<ul class="file-list">${files.map(f=>`<li><div><strong>${esc(f.name)}</strong><span>${esc(f.type)} · ${FileList.size(f.size)}</span></div><a href="${esc(f.url)}" download>Скачать</a></li>`).join('')}</ul>`:'<p>Файлы пока не добавлены.</p>'}
};
const ProjectTabs={
 list(project){const tabs=[...(project.tabs||[])];const overview=tabs.find(t=>t.id==='overview')||{id:'overview',title:'Обзор',type:'text',sortOrder:0,content:{paragraphs:[project.description]}};return [{...overview,title:'Обзор'},...tabs.filter(t=>t.id!=='overview').sort((a,b)=>a.sortOrder-b.sortOrder)]},
 active(project,id){const tabs=ProjectTabs.list(project);return tabs.find(t=>t.id===id)||tabs[0]},
 href(project,tab,category){const query=new URLSearchParams();if(category)query.set('category',category);query.set('tab',tab.id);return `#/project/${project.slug||project.id}?${query}`},
 render(project,selected,category){return `<div class="project-tabs" role="tablist" aria-label="Материалы проекта">${ProjectTabs.list(project).map(t=>`<a role="tab" id="tab-${esc(t.id)}" data-project-tab="${esc(t.id)}" href="${esc(ProjectTabs.href(project,t,category))}" aria-controls="project-panel" aria-selected="${t.id===selected.id}" tabindex="${t.id===selected.id?'0':'-1'}">${esc(t.title)}</a>`).join('')}</div>`}
};
function buildTelegramPublication(project,url){const meta=project.telegram||{};return [meta.title||project.title,meta.description||project.description,url].filter(Boolean).join('\n\n')}
const ProjectPage={
 gallery(images=[]){return `<div class="project-gallery">${images.map(img=>`<figure><button type="button" data-project-image="${esc(img.src)}" data-large-path="${esc(img.largePath||'')}" data-caption="${esc(img.caption||img.alt||'')}" aria-label="Увеличить: ${esc(img.alt||img.caption||'фотографию')}"><img src="${esc(img.src)}" alt="${esc(img.alt||img.caption||'Иллюстрация проекта')}" loading="lazy" decoding="async" ${img.width&&img.height?`width="${img.width}" height="${img.height}"`: ''}></button>${img.caption?`<figcaption>${esc(img.caption)}</figcaption>`:''}</figure>`).join('')}</div>`},
 content(type,data={}){
 switch(type){
 case 'richtext':return `<div class="project-prose">${window.A45Cloud?.richText(data.text)||esc(data.text||'')}</div>`;
 case 'heading':return `<h2>${esc(data.text||'')}</h2>`;
 case 'external-video':{const url=window.A45Cloud?.safeUrl(data.url);return url?`<figure class="project-video"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Смотреть видео</a>${data.caption?`<figcaption>${esc(data.caption)}</figcaption>`:''}</figure>`:'';}
 case 'text':return `<div class="project-prose">${data.heading?`<h2>${esc(data.heading)}</h2>`:''}${(data.paragraphs||[]).map(p=>`<p>${esc(p)}</p>`).join('')}${data.steps?`<ol>${data.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:''}</div>`;
 case 'gallery':return ProjectPage.gallery(data.images);
 case 'image':return `<figure class="project-cover"><button type="button" data-project-image="${esc(data.src)}" data-large-path="${esc(data.largePath||'')}" data-caption="${esc(data.caption||'')}" aria-label="Увеличить изображение"><img src="${esc(data.src)}" alt="${esc(data.alt||data.caption||'Обложка проекта')}" loading="lazy" decoding="async" ${data.width&&data.height?`width="${data.width}" height="${data.height}"`: ''}></button>${data.caption?`<figcaption>${esc(data.caption)}</figcaption>`:''}</figure>`;
 case 'video':return `<figure class="project-video"><video controls playsinline preload="metadata" ${data.poster?`poster="${esc(data.poster)}"`:''} src="${esc(data.src)}">Ваш браузер не поддерживает видео. <a href="${esc(data.src)}">Скачать видео</a></video>${data.caption?`<figcaption>${esc(data.caption)}</figcaption>`:''}</figure>`;
 case 'files':return FileList.render(data.files);
 case 'specs':return `<section class="project-specs"><h2>${esc(data.title||'Характеристики')}</h2><dl>${(data.items||[]).map(([name,value])=>`<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></section>`;
 case 'mixed':return (Array.isArray(data)?data:[]).map(block=>ProjectPage.content(block.type,block.content)).join('');
 default:return '<p>Материал пока недоступен.</p>'}
 },
 shareHref(project){const url=location.href;const title=project.telegram?.title||project.title;return 'https://t.me/share/url?'+new URLSearchParams({url,text:title})},
 render(project,cat,selectedId){const selected=ProjectTabs.active(project,selectedId);return `<article class="project-page"><div class="project-title"><h1>${esc(project.title)}</h1>${project.telegram?.enabled?`<a class="project-share" id="project-share" href="${esc(ProjectPage.shareHref(project))}" target="_blank" rel="noopener noreferrer" aria-label="Поделиться в Telegram">Поделиться</a>`:''}</div>${ProjectTabs.render(project,selected,route.category)}<section id="project-panel" class="project-panel" role="tabpanel" aria-labelledby="tab-${esc(selected.id)}" tabindex="0">${ProjectPage.content(selected.type,selected.content)}</section><a class="back-link" href="#/category/${cat.id}">← Вернуться: ${esc(cat.title)}</a></article>`},
 update(project,tabId){const selected=ProjectTabs.active(project,tabId);const page=document.scrollingElement;const top=page.scrollTop;const panel=$('#project-panel');
 // Keep enough room below the current viewport when switching to a shorter tab.
 panel.style.minHeight=`${Math.max(0,window.innerHeight-panel.getBoundingClientRect().top)}px`;
 panel.innerHTML=ProjectPage.content(selected.type,selected.content);panel.setAttribute('aria-labelledby','tab-'+selected.id);
 document.querySelectorAll('[data-project-tab]').forEach(a=>{const active=a.dataset.projectTab===selected.id;a.setAttribute('aria-selected',String(active));a.setAttribute('tabindex',active?'0':'-1')});
 const share=$('#project-share');if(share)share.href=ProjectPage.shareHref(project);page.scrollTop=top;
 },
 async openImage(button){const dialog=$('#project-lightbox');const request=ProjectPage.imageRequest=Symbol();$('#lightbox-image').src=button.dataset.projectImage;$('#lightbox-image').alt=button.dataset.caption;$('#lightbox-caption').textContent=button.dataset.caption;dialog.showModal();if(button.dataset.largePath&&window.A45Cloud?.largeImage){try{const url=await window.A45Cloud.largeImage(button.dataset.largePath);if(dialog.open&&ProjectPage.imageRequest===request)$('#lightbox-image').src=url}catch{ $('#lightbox-caption').textContent='Не удалось загрузить увеличенное изображение. Закройте и откройте его для повтора.'}}},
 keydown(e){if(!e.target?.matches?.('[data-project-tab]'))return;const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();const links=[...document.querySelectorAll('[data-project-tab]')];let i=links.indexOf(e.target);i=e.key==='Home'?0:e.key==='End'?links.length-1:(i+(e.key==='ArrowRight'?1:-1)+links.length)%links.length;links[i].focus({preventScroll:true});links[i].click()}
};
