import { optimize } from './image-optimizer.mjs';
self.onmessage=async({data})=>{try{self.postMessage({result:await optimize(data.file,data.crop)})}catch(error){self.postMessage({error:error.message})}};
