// Archive and restore always persist on the server; a failed write leaves the list intact.
export async function removeProject({id,service,projects,refresh=async()=>{}}){
 const doc=await service.get(id),previous=doc.status;
 await service.save(doc,new Map(),'draft');
 const index=projects.findIndex(p=>p.id===id),snapshot=index>=0?projects[index]:null;if(index>=0)projects.splice(index,1);await refresh();
 return {restore:async()=>{await service.save(doc,new Map(),previous);if(snapshot&&!projects.some(p=>p.id===id))projects.push(snapshot);await refresh()}};
}
