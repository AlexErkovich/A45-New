import {openMediaDialog} from './media-dialog.mjs';
export {paginateCaption} from './media-caption.mjs';
export function openPhotoDialog({root,doc,tab,urls,id,blockId,itemIndex,onChange,onDelete,onClose,resolveMedia}){
 const blocks=blockId?tab.blocks.filter(b=>b.id===blockId):tab.blocks;
 const contents=id=>blocks.flatMap(b=>b.type==='IMAGE'?[b.content]:b.type==='GALLERY'?b.content.items||[]:[]).filter(c=>c.mediaId===id);
 const contentFor=id=>{const selected=blocks[0]?.content.items?.[itemIndex];return selected?.mediaId===id?selected:contents(id)[0]};
 const ids=[...new Set(blocks.flatMap(b=>b.type==='IMAGE'?[b.content.mediaId]:b.type==='GALLERY'?(b.content.items||[]).map(i=>i.mediaId):[]).filter(id=>doc.media.some(m=>m.id===id)))];
 const items=ids.map(id=>{const m=doc.media.find(m=>m.id===id);return {id,kind:'image',name:m.name||m.alt||'Фотография',size:m.size,type:m.mimeType,downloadPath:m.path,mediaPath:m.variants?.content||m.path,largePath:m.variants?.large,src:urls[id]||m.localUrl||m.path,alt:m.alt||m.name,title:m.alt||m.name||'',date:m.createdAt,caption:contentFor(id)?.caption??m.caption??''}});
 return openPhotoCarousel({root,items,id,editable:true,projectDescription:doc.description,onClose,onDelete,resolveMedia,onTitle:(id,value)=>{doc.media.find(m=>m.id===id).alt=value;onChange()},isCover:id=>doc.coverMediaId===id,onCaption:(id,value)=>{const content=contentFor(id);if(content)content.caption=value;onChange()},onCover:(id,checked)=>{if(checked){doc.coverMediaId=id;doc.coverOriginalId=id}else if(doc.coverMediaId===id){doc.coverMediaId=null;doc.coverOriginalId=null;delete doc.cardImage}onChange()}});
}

export function openPhotoCarousel(options){return openMediaDialog({...options,items:options.items.map(item=>({...item,kind:'image',name:item.name||item.title||item.alt||'Фотография',url:item.url||item.src}))})}
