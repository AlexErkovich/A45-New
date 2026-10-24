import {sameFileContent} from './file-content.mjs';
import {ensureCategory as ensurePlacement} from './category-placement.mjs';
import {newProject,publicProject,uid} from './project-model.mjs';
import {prepareImage} from './image-optimizer.mjs';
export function createCardCreation({categoryService,projectService,refreshCategories,refreshProjects,prepare=prepareImage}){
 const jobs=new Map();
 async function rpc(name,args){const {data,error}=await categoryService.client.rpc(name,args);if(error)throw Error(error.message||'Не удалось сохранить раздел.');return Array.isArray(data)?data[0]:data}

 async function create(input,progress=()=>{}){
  if(!categoryService||!await categoryService.isAdmin(true))throw Error('Для сохранения на сайте войдите администратором. Введённые данные остаются в окне.');
  input={...input,title:(input.title||'').trim(),description:(input.description||'').trim()};
  if(!input.title)throw Error('Введите название '+(input.kind==='project'?'проекта.':'раздела.'));
  const rows=await categoryService.listAdmin(),known=new Set(rows.map(r=>r.id));
  if(input.parentId)await ensurePlacement(categoryService,input.parentId,known);
  if(input.kind==='subcategory'||input.kind==='section'){
   let job=jobs.get(input.id);
   if(!job){const path=input.file?input.id+'/'+crypto.randomUUID()+'.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[input.file.type]||'webp'):null;progress('Создание раздела…');const row=await rpc('create_a45_category',{doc:{id:input.id,parentId:input.parentId,title:input.title,description:input.description,coverPath:path}});job={row,file:input.file};jobs.set(input.id,job)}
   if(job.row.title!==input.title||job.row.description!==input.description||job.file!==input.file){const result=await categoryService.save(job.row,{title:input.title,description:input.description,blob:job.file!==input.file?input.file:null,removeCover:!input.file});job.row=result.category;job.file=input.file}
   if(input.file){progress('Загрузка обложки…');const path=job.row.cover_image_path,storage=categoryService.client.storage.from('category-covers');const upload=await storage.upload(path,input.file,{upsert:false,contentType:input.file.type,cacheControl:'31536000'});if(upload.error){const existing=await storage.download(path);const equal=await sameFileContent(existing.data,input.file);if(existing.error||!equal)throw Error('Не удалось загрузить обложку. Повторите сохранение.')}}
   const saved=await rpc('publish_a45_category',{category_id:input.id});
   job.row=saved;await categoryService.includeNavigation?.(saved);await refreshCategories();jobs.delete(input.id);
   return {category:{id:saved.id,parentId:saved.parent_id,title:saved.title,description:saved.description,image:saved.cover_image_path?categoryService.coverUrl(saved.cover_image_path):'assets/cover-placeholder.svg',slug:saved.slug,sortOrder:saved.sort_order,custom:true}};
  }
  let job=jobs.get(input.id);
  if(!job){const doc=newProject(input.parentId);doc.id=input.id;job={doc,pending:new Map(),file:input.file,prepared:false};jobs.set(input.id,job)}
  if(job.file!==input.file){job.file=input.file;job.prepared=false}
  const {doc,pending}=job;doc.title=input.title;doc.description=input.description;
  if(input.file&&!job.prepared){const result=await prepare(input.file,undefined,progress),mediaId=uid(),path=doc.id+'/'+mediaId;
   const variants={};const files=[{path,file:input.file}];for(const name of ['thumbnail','content','large']){variants[name]=path+'/'+name+'.webp';files.push({path:variants[name],file:result[name]})}
   doc.media.push({id:mediaId,path,name:input.file.name||'cover.jpg',mimeType:input.file.type,size:input.file.size,kind:'image',variants,width:result.width,height:result.height,alt:input.title,caption:''});
   doc.coverMediaId=mediaId;doc.coverOriginalId=mediaId;pending.set(mediaId,{files});job.prepared=true;
  }
  await projectService.save(doc,pending,'published',progress);
  const project=publicProject(doc,await projectService.publicUrls(doc));
  await refreshProjects();jobs.delete(input.id);return {project};
 }
 return {create,release:id=>jobs.delete(id)};
}
