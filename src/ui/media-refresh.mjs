// Renew resources in place: an expired link must not replace the page or its reading state.
export function installMediaRefresh(document,resolve){
 const failures=new WeakMap();
 document.addEventListener('error',async event=>{const image=event.target;if(image.tagName!=='IMG'||!image.dataset.mediaPath)return;const failed=image.getAttribute('src');if(failures.get(image)===failed)return;failures.set(image,failed);try{const url=await resolve(image.dataset.mediaPath,{force:true});if(!image.isConnected||image.getAttribute('src')!==failed)return;image.src=url;const button=image.closest('[data-project-image]');if(button)button.dataset.projectImage=url}catch{/* The original failure remains visible; no automatic retry loop. */}},true);
 document.addEventListener('click',async event=>{const link=event.target.closest('a[data-media-path][download]');if(!link||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();if(link.dataset.downloading)return;link.dataset.downloading='true';try{const url=await resolve(link.dataset.mediaPath,{download:link.getAttribute('download')||true});const download=document.createElement('a');download.href=url;download.download=link.getAttribute('download')||'';download.target='_blank';download.rel='noopener';download.click()}catch(error){document.defaultView.A45Feedback?.show(link,{tone:'error',message:'Не удалось открыть файл. '+(error.message||'Повторите попытку.')})}finally{delete link.dataset.downloading}},true);
}
export function refreshMediaElements(root,project){
 const sources=new Map();
 const visit=(type,data)=>{if(type==='mixed'){for(const block of Array.isArray(data)?data:[])visit(block.type,block.content)}else if(type==='image'){if(data.mediaPath)sources.set(data.mediaPath,data.src)}else if(type==='gallery'){for(const image of data.images||[])if(image.mediaPath)sources.set(image.mediaPath,image.src)}else if(type==='files'){for(const file of data.files||[])if(file.mediaPath)sources.set(file.mediaPath,file.url)}};
 for(const tab of project.tabs||[])visit(tab.type,tab.content);
 if(project.imagePath)sources.set(project.imagePath,project.image);
 root.querySelectorAll('[data-media-path]').forEach(node=>{const url=sources.get(node.dataset.mediaPath);if(!url)return;if(node.tagName==='IMG'){if(node.getAttribute('src')!==url)node.src=url;const button=node.closest('[data-project-image]');if(button)button.dataset.projectImage=url}else if(node.tagName==='A')node.href=url});
 return sources;
}
