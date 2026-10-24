// One application and one set of views; only the route grants a management context.
export const isAdminRoute=(location=globalThis.location)=>location.pathname==='/admin';
export function editorRoute(location=globalThis.location){
 if(!isAdminRoute(location))return null;
 const [path,query='']=location.hash.slice(2).split('?');
 const match=/^project\/(new|edit\/([^/]+))$/.exec(path);
 if(!match)return null;
 try{return {id:match[2]?decodeURIComponent(match[2]):'',params:new URLSearchParams(query)}}catch{return null}
}
export function canonicalPath(location=globalThis.location){
 const {pathname,search,hash}=location;
 if(pathname==='/admin/')return '/admin'+search+hash;
 if(pathname==='/login/')return '/login'+search+hash;
 if(/^\/project\/(new|drafts|edit\/[^/]+)$/.test(pathname))return '/admin#'+(pathname==='/project/drafts'?'/drafts':pathname)+search;
 if(pathname==='/transfer')return '/admin#/transfer'+search;
 if(pathname==='/'&&hash.startsWith('#/login'))return '/login'+hash.slice('#/login'.length);
 if(pathname==='/'&&hash==='#/admin')return '/admin';
 if(pathname==='/'&&/^#\/(drafts|transfer|project\/(new|edit\/[^/?]+))(\?|$)/.test(hash))return '/admin'+hash;
 return pathname+search+hash;
}
export function adminReturnTarget(value,origin=globalThis.location.origin){
 if(typeof value!=='string')return '/admin';
 try{
  const candidate=value.startsWith('#/')?'/'+value:value;
  if(!candidate.startsWith('/')||candidate.startsWith('//')||candidate.includes('\\'))return '/admin';
  const url=new URL(candidate,origin);
  if(url.origin!==origin)return '/admin';
  const target=canonicalPath(url),canonical=new URL(target,origin);
  if(canonical.pathname==='/admin')return target;
  // A legacy interrupted card dialog can resume, but always in management.
  if(canonical.pathname==='/'&&/^#\/(category|project|projects|year|about)(\/|\?|$)/.test(canonical.hash))return '/admin'+canonical.hash;
 }catch{}
 return '/admin';
}
export function contextualHref(href,location=globalThis.location){
 if(!isAdminRoute(location))return href;
 if(href.startsWith('#/'))return '/admin'+href;
 if(href.startsWith('/#/'))return '/admin'+href.slice(1);
 return href;
}
