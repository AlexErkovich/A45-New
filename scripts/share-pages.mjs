// Crawler-readable previews for projects included in this static build.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import vm from 'node:vm';
export async function buildSharePages(root,output){
 const context={window:{}};vm.createContext(context);
 vm.runInContext(await readFile(new URL('../data/projects.js',import.meta.url),'utf8'),context);
 const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 for(const project of context.window.archiveData.projects){
  const slug=encodeURIComponent(project.slug||project.id);
  const route='/#/project/'+slug;
  const image=/\.(png|jpe?g|webp)(?:\?|$)/i.test(project.image||'')?project.image:'assets/home/craft.jpg';
  // Root-relative URLs resolve against the deployment host, also on preview deployments.
  const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escape(project.title)} — A45</title><meta name="description" content="${escape(project.description)}"><meta property="og:type" content="article"><meta property="og:title" content="${escape(project.title)}"><meta property="og:description" content="${escape(project.description)}"><meta property="og:image" content="/${escape(image)}"><meta name="twitter:card" content="summary_large_image"><meta http-equiv="refresh" content="0;url=${escape(route)}"></head><body><a href="${escape(route)}">${escape(project.title)}</a></body></html>`;
  await mkdir(output+'/share',{recursive:true});
  await writeFile(output+'/share/'+slug+'.html',html);
 }
}
