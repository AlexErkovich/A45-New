// Structured-clone storage keeps original Blobs; unlike localStorage it is not a text-only cache.
export function createEditorRecovery(factory=globalThis.indexedDB){
 let database;
 async function db(){if(!factory)return null;if(!database)database=new Promise((resolve,reject)=>{const request=factory.open('a45-editor-recovery',1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});return database}
 async function transaction(mode,run){const database=await db();if(!database)return;return new Promise((resolve,reject)=>{const tx=database.transaction('drafts',mode),request=run(tx.objectStore('drafts'));let result;request.onsuccess=()=>{result=request.result};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Не удалось записать резервную копию.'))})}
 return {available:!!factory,put:record=>transaction('readwrite',store=>store.put(record)),get:id=>transaction('readonly',store=>store.get(id)),list:async()=>await transaction('readonly',store=>store.getAll())||[],remove:id=>transaction('readwrite',store=>store.delete(id))};
}
