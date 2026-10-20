// Real browser codecs/Worker, no Supabase or network services. Run on macOS with Chrome.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const temp=await mkdtemp(join(tmpdir(),'a45-image-test-'));
let chrome,server;
try{
 await build({entryPoints:['src/image-optimizer.mjs'],bundle:true,format:'iife',globalName:'Optimizer',outfile:join(temp,'optimizer.js')});
 await build({entryPoints:['src/image-worker.mjs'],bundle:true,format:'iife',outfile:join(temp,'image-worker.js')});
 server=createServer(async(req,res)=>{try{if(req.url==='/'){res.end('<script src="/optimizer.js"></script>');return}res.setHeader('Content-Type','application/javascript');res.end(await readFile(join(temp,req.url==='/optimizer.js'?'optimizer.js':'image-worker.js')))}catch{res.writeHead(404).end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+join(temp,'profile'),'about:blank'],{stdio:'ignore'});
 let port;for(let i=0;i<100;i++){try{port=(await readFile(join(temp,'profile/DevToolsActivePort'),'utf8')).split('\n')[0];break}catch{await new Promise(r=>setTimeout(r,100))}}assert(port,'Chrome debugging port');
 const page=await (await fetch('http://127.0.0.1:'+port+'/json/new?'+encodeURIComponent(origin),{method:'PUT'})).json();
 const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}});
 const command=(method,params={})=>new Promise(r=>{const id=++seq;pending.set(id,r);ws.send(JSON.stringify({id,method,params}))});
 for(let i=0;i<100;i++){const r=await command('Runtime.evaluate',{expression:'typeof Optimizer'});if(r.result?.result?.value==='object')break;await new Promise(r=>setTimeout(r,50))}
 const result=await command('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
 const assert=(ok,msg)=>{if(!ok)throw Error(msg)};const results=[];
 async function fixture(w,h,type='image/jpeg'){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle='#e09c42';ctx.fillRect(0,0,w/2,h);return new File([await new Promise(r=>c.toBlob(r,type,.95))],'photo.'+(type==='image/png'?'png':'jpg'),{type})}
 async function check(file,w,h){const before=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());const out=await Optimizer.prepareImage(file);assert(out.width===w&&out.height===h,'orientation/dimensions');for(const [name,max] of [['content',1600],['large',2400]]){const b=await createImageBitmap(out[name]);assert(Math.max(b.width,b.height)<=max,'limit');assert(b.width<=w&&b.height<=h,'no upscale');assert(Math.abs(b.width/b.height-w/h)<.005,'aspect');b.close();assert(out[name].type==='image/webp','WebP');const raw=new TextDecoder('latin1').decode(await out[name].arrayBuffer());assert(!raw.includes('EXIF')&&!raw.includes('PRIVATE-GPS'),'metadata stripped')}const t=await createImageBitmap(out.thumbnail);assert(t.width<=600&&t.height<=450,'thumbnail max');assert(Math.abs(t.width/t.height-4/3)<.025,'thumbnail 4:3');t.close();assert(String(new Uint8Array(before))===String(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))),'original unchanged');results.push({input:file.size,w,h,content:out.content.size,large:out.large.size});return out}
 await check(await fixture(3200,1800),3200,1800);await check(await fixture(2000,3000),2000,3000);await check(await fixture(2000,2000),2000,2000);const alpha=await check(await fixture(100,80,'image/png'),100,80);const ab=await createImageBitmap(alpha.content);const ac=new OffscreenCanvas(100,80);ac.getContext('2d').drawImage(ab,0,0);assert(ac.getContext('2d').getImageData(90,10,1,1).data[3]===0,'transparent PNG preserved');await check(await fixture(64,48),64,48);
 const base=await fixture(4000,3000);const big=new File([base,new Uint8Array(18*1024*1024-base.size)],'large.jpg',{type:'image/jpeg'});await check(big,4000,3000);
 // EXIF little-endian TIFF, orientation 6 (90 degrees clockwise).
 const jpg=new Uint8Array(await (await fixture(120,80)).arrayBuffer());const exif=new Uint8Array([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);await check(new File([jpg.slice(0,2),exif,jpg.slice(2)],'rotated.jpg',{type:'image/jpeg'}),80,120);
 for(const file of [new File(['wrong'],'bad.png',{type:'image/png'}),new File([new Uint8Array(30*1024*1024+1)],'huge.jpg',{type:'image/jpeg'}),new File(['x'],'bad.gif',{type:'image/gif'})]){let failed=false;try{await Optimizer.prepareImage(file)}catch{failed=true}assert(failed,'invalid file rejected')}
 return results;
 })()`});
 assert(!result.result.exceptionDetails,JSON.stringify(result.result.exceptionDetails));console.log('PASS: real Chrome Worker, 18 MB JPG, portrait/landscape/square, alpha PNG, tiny image, EXIF orientation, unchanged originals, metadata removal, WebP dimensions and rejected files.');console.log(JSON.stringify(result.result.result.value));ws.close();
}finally{chrome?.kill();server?.close();await new Promise(r=>setTimeout(r,500));await rm(temp,{recursive:true,force:true})}
