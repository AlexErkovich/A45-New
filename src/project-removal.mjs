// Foreign browser-owned records stay protected; a reversible local removal is allowed.
export async function removeProject({id,service,storage,projects,refresh=async()=>{}}){
 let doc,previous;
 try{doc=await service.get(id);previous=doc.status;await service.save(doc,new Map(),'draft')}
 catch(error){if(!/belongs to another browser/i.test(error.message||''))throw error;
  const key='a45-hidden-projects',read=()=>JSON.parse(storage.getItem(key)||'[]');const previousIds=read();storage.setItem(key,JSON.stringify([...new Set([...previousIds,id])]));
  return {localOnly:true,restore:async()=>{storage.setItem(key,JSON.stringify(read().filter(value=>value!==id)))}};
 }
 const index=projects.findIndex(p=>p.id===id),snapshot=index>=0?projects[index]:null;if(index>=0&&!service.isLocal?.(id))projects.splice(index,1);await refresh();
 return {restore:async()=>{await service.save(doc,new Map(),previous);if(snapshot&&!projects.some(p=>p.id===id))projects.push(snapshot);await refresh()}};
}
