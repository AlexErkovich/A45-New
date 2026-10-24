import {openMediaDialog} from './media-dialog.mjs';
export {paginateCaption} from './media-caption.mjs';
export function openPhotoDialog({root,doc,tab,urls,id,onChange,onDelete,onClose,resolveMedia}){
 const ids=[...new Set(tab.blocks.flatMap(b=>b.type==='IMAGE'?[b.content.mediaId]:b.type==='GALLERY'?(b.content.items||[]).map(i=>i.mediaId):[]).filter(id=>doc.media.some(m=>m.id===id)))];
 const items=ids.map(id=>{const m=doc.media.find(m=>m.id===id);return {id,kind:'image',name:m.name||m.alt||'Фотография',size:m.size,type:m.mimeType,downloadPath:m.path,mediaPath:m.variants?.content||m.path,largePath:m.variants?.large,src:urls[id]||m.localUrl||m.path,alt:m.alt||m.name,title:m.alt||m.name||'',date:m.createdAt,caption:m.caption||tab.blocks.flatMap(b=>b.type==='IMAGE'?[b.content]:b.content.items||[]).find(i=>i.mediaId===id)?.caption||''}});
 return openPhotoCarousel({root,items,id,editable:true,projectDescription:doc.description,onClose,onDelete,resolveMedia,onTitle:(id,value)=>{doc.media.find(m=>m.id===id).alt=value;onChange()},isCover:id=>doc.coverMediaId===id,onCaption:(id,value)=>{doc.media.find(m=>m.id===id).caption=value;for(const t of doc.tabs)for(const b of t.blocks){if(b.type==='IMAGE'&&b.content.mediaId===id)b.content.caption=value;if(b.type==='GALLERY')for(const item of b.content.items||[])if(item.mediaId===id)item.caption=value}onChange()},onCover:(id,checked)=>{if(checked){doc.coverMediaId=id;doc.coverOriginalId=id}else if(doc.coverMediaId===id){doc.coverMediaId=null;doc.coverOriginalId=null;delete doc.cardImage}onChange()}});
}

export function openPhotoCarousel(options){return openMediaDialog({...options,items:options.items.map(item=>({...item,kind:'image',name:item.name||item.title||item.alt||'Фотография',url:item.url||item.src}))})}
