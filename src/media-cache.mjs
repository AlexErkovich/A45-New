// Scoped to one service/session. Signed links are renewed before expiry; Blob fallbacks are bounded.
export function createMediaCache(storage,{now=Date.now,ttl=900,maxLinks=256,maxBlobs=24}={}){
 const links=new Map(),blobs=new Map(),inflight=new Map();let generation=0;
 function touch(map,key,value){map.delete(key);map.set(key,value)}
 function prune(){while(links.size>maxLinks)links.delete(links.keys().next().value);while(blobs.size>maxBlobs){const key=blobs.keys().next().value;URL.revokeObjectURL(blobs.get(key));blobs.delete(key)}}
 async function resolve(path,{force=false,download}={}){if(!path)throw Error('Файл не найден.');const key=path+'|'+(download||''),cached=links.get(key);if(!force&&cached&&cached.expires>now()+60000){touch(links,key,cached);return cached.url}if(inflight.has(key))return inflight.get(key);const token=generation;
  const task=(async()=>{if(storage.createSignedUrl){const {data,error}=await storage.createSignedUrl(path,ttl,download?{download}:undefined);if(error)throw error;if(token!==generation)throw Error('Сессия загрузки завершена.');touch(links,key,{url:data.signedUrl,expires:now()+ttl*1000});prune();return data.signedUrl}
   if(!force&&blobs.has(path)){const url=blobs.get(path);touch(blobs,path,url);return url}const {data,error}=await storage.download(path);if(error)throw error;if(token!==generation)throw Error('Сессия загрузки завершена.');const url=URL.createObjectURL(data);if(blobs.has(path))URL.revokeObjectURL(blobs.get(path));touch(blobs,path,url);prune();return url})();inflight.set(key,task);try{return await task}finally{if(inflight.get(key)===task)inflight.delete(key)}
 }
 function clear(){generation++;for(const url of blobs.values())URL.revokeObjectURL(url);blobs.clear();links.clear();inflight.clear()}
 return {resolve,clear};
}
