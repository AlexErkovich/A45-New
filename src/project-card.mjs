import {uid,publicProject} from './project-model.mjs';
import {prepareImage} from './image-optimizer.mjs';
// Card changes share persistence with the page editor, without rebuilding page content.
export function createProjectCardEditor({service,prepare=prepareImage,ensureCategory=async()=>{}}){
 const jobs=new Map();
 return async function saveCard(input,progress=()=>{}){
  const title=(input.title||'').trim();if(!title)throw Error('Введите название проекта.');
  let job=jobs.get(input.id);if(!job){job={doc:await service.get(input.id),pending:new Map(),file:null};jobs.set(input.id,job)}
  const doc=job.doc;doc.title=title;doc.description=(input.description||'').trim();if(input.categoryId&&input.categoryId!==doc.primaryCategoryId){if(!service.isLocal?.(doc.id))await ensureCategory(input.categoryId);const previous=doc.primaryCategoryId;doc.primaryCategoryId=input.categoryId;doc.categoryIds=[input.categoryId,...doc.categoryIds.filter(id=>id!==previous&&id!==input.categoryId)]}
  if(input.file&&job.file!==input.file){const result=await prepare(input.file,undefined,progress),id=uid(),path=doc.id+'/'+id,variants={},files=[{path,file:input.file}];for(const name of ['thumbnail','content','large']){variants[name]=path+'/'+name+'.webp';files.push({path:variants[name],file:result[name]})}doc.media.push({id,path,name:input.file.name||'cover.jpg',mimeType:input.file.type,size:input.file.size,kind:'image',variants,width:result.width,height:result.height,alt:title,caption:''});doc.coverMediaId=id;doc.coverOriginalId=id;job.pending.set(id,{files});job.file=input.file}
  await service.save(doc,job.pending,doc.status,progress);
  const local=!!service.isLocal?.(doc.id);let urls={};try{urls=local?await service.mediaUrls(doc):await service.publicUrls(doc)}catch{}
  const project=publicProject(doc,urls);if(project.image==='assets/cover-placeholder.svg'&&input.image)project.image=input.image;project.cloud=!local;if(local)project.slug=doc.slug||doc.id;jobs.delete(input.id);return {project};
 }
}
