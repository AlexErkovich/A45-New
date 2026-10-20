import { cropRect,validateImage } from './category-service.mjs';
export const ORIGINAL_LIMIT=30*1024*1024;
export function fit(width,height,max){const scale=Math.min(1,max/Math.max(width,height));return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))}}
export async function validateOriginal(file){if(!file||file.size>ORIGINAL_LIMIT)throw Error('Максимальный размер фотографии — 30 МБ.');await validateImage({type:file.type,size:Math.min(file.size,1024),slice:(...args)=>file.slice(...args)})}
export async function optimize(file,crop={zoom:1,x:.5,y:.5}){
 const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
 try{const width=bitmap.width,height=bitmap.height;if(width*height>100000000)throw Error('Максимум 100 мегапикселей.');
 const output={width,height};for(const [name,max] of [['thumbnail',600],['content',1600],['large',2400]]){const r=name==='thumbnail'?cropRect(width,height,crop.zoom,crop.x,crop.y):{sx:0,sy:0,sw:width,sh:height};const size=name==='thumbnail'?fit(r.sw,r.sh,600):fit(width,height,max);const canvas=new OffscreenCanvas(size.width,size.height);canvas.getContext('2d').drawImage(bitmap,r.sx,r.sy,r.sw,r.sh,0,0,size.width,size.height);const blob=await canvas.convertToBlob({type:'image/webp',quality:.85});if(blob.type!=='image/webp')throw Error('Браузер не поддерживает WebP. Используйте современный Chrome, Edge или Firefox.');output[name]=blob}return output;
 }finally{bitmap.close()}
}
export async function prepareImage(file,crop,progress=()=>{}){progress('Подготовка изображения…');await validateOriginal(file);progress('Оптимизация…');return new Promise((resolve,reject)=>{const worker=new Worker('/image-worker.js');worker.onmessage=({data})=>{worker.terminate();data.error?reject(Error(data.error)):resolve(data.result)};worker.onerror=()=>{worker.terminate();reject(Error('Обработка изображения не удалась. Повторите выбор файла.'))};worker.postMessage({file,crop})})}
