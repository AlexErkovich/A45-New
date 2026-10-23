// Persist client-seeded category ancestors before assigning a cloud project.
export async function ensureCategory(service,id,known,categories=globalThis.window?.archiveData?.categories||[]){
 if(known.has(id))return;const c=categories.find(c=>c.id===id);if(!c)throw Error('Раздел не найден. Обновите страницу.');
 if(c.parentId)await ensureCategory(service,c.parentId,known,categories);
 const {error}=await service.client.rpc('create_a45_category',{doc:{id:c.id,parentId:c.parentId,title:c.title,description:c.description||''}});if(error)throw Error(error.message||'Не удалось подготовить раздел.');known.add(id);
}
