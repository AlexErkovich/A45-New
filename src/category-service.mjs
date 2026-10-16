export const MAX_IMAGE_BYTES=5*1024*1024;
export const IMAGE_TYPES=['image/jpeg','image/png','image/webp'];
export function cropRect(width,height,zoom=1,x=.5,y=.5){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('Некорректный размер изображения.');
 const z=Math.max(1,Math.min(3,Number(zoom)||1));const w=Math.min(width,height*4/3)/z,h=w*3/4;
 return {sx:(width-w)*Math.max(0,Math.min(1,Number(x))),sy:(height-h)*Math.max(0,Math.min(1,Number(y))),sw:w,sh:h};
}
export async function validateImage(file){
 if(!file||!IMAGE_TYPES.includes(file.type))throw new Error('Выберите JPG, PNG или WebP.');
 if(!file.size||file.size>MAX_IMAGE_BYTES)throw new Error('Максимальный размер фотографии — 5 МБ.');
 const b=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const png=[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v),jpg=b[0]===255&&b[1]===216&&b[2]===255;
 const webp=String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP';
 if(!({ 'image/png':png,'image/jpeg':jpg,'image/webp':webp }[file.type]))throw new Error('Содержимое файла не соответствует типу изображения.');
}
export function createCategoryService(client){
 const storage=client.storage.from('category-covers');
 return {
 client,
 async listPublic(){const {data,error}=await client.from('categories').select('*').eq('is_published',true).order('sort_order');if(error)throw error;return data},
 async isAdmin(){const {data:{user},error}=await client.auth.getUser();if(error||!user)return false;const result=await client.rpc('is_a45_admin');if(result.error)throw result.error;return result.data===true},
 async listAdmin(){if(!await this.isAdmin())throw new Error('Нет прав администратора.');const {data,error}=await client.from('categories').select('*').order('sort_order');if(error)throw error;return data},
 coverUrl(path){if(!path)return null;return storage.getPublicUrl(path).data.publicUrl},
 async save(previous,{title,description,blob}){
  if(!await this.isAdmin())throw new Error('Сессия истекла или нет прав администратора.');
  title=title.trim();if(!title||title.length>160||description.length>4000)throw new Error('Проверьте название и описание.');
  let path=previous.cover_image_path;
  if(blob){if(!IMAGE_TYPES.includes(blob.type)||!blob.size||blob.size>MAX_IMAGE_BYTES)throw new Error('Некорректная фотография.');const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[blob.type];path=`${previous.id}/${crypto.randomUUID()}.${extension}`;
   const {error}=await storage.upload(path,blob,{upsert:false,contentType:blob.type,cacheControl:'31536000'});if(error)throw new Error('Не удалось загрузить фотографию. Проверьте соединение и права Storage.');}
  const {data,error}=await client.from('categories').update({title,description,cover_image_path:path}).eq('id',previous.id).eq('updated_at',previous.updated_at).select().single();
  if(error){
   // A network error may occur after COMMIT. Never delete an upload unless its state is known.
   throw new Error('Сохранение не подтверждено. Обновите список и проверьте результат перед повторной попыткой. Возможно, запись уже изменена в другой вкладке. Предыдущая фотография не удалена.');
  }
  let warning='';if(blob&&previous.cover_image_path&&previous.cover_image_path!==path){const result=await storage.remove([previous.cover_image_path]);if(result.error)warning='Изменения сохранены, но старый файл не удалён. Его можно убрать позднее через Storage.'}
  return {category:data,warning};
 }
 };
}
