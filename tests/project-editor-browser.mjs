// Real browser codecs/Worker, no Supabase or network services. Run on macOS with Chrome.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const temp=await mkdtemp(join(tmpdir(),'a45-image-test-'));
let chrome,server;
try{
 await build({entryPoints:['tests/project-editor-fixture.mjs'],bundle:true,format:'iife',outfile:join(temp,'optimizer.js')});
 await build({entryPoints:['src/image-worker.mjs'],bundle:true,format:'iife',outfile:join(temp,'image-worker.js')});
 server=createServer(async(req,res)=>{try{if(req.url==='/project/edit/fixture'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/admin.css"><main id="main"></main><script src="/optimizer.js"></script>');return}if(['/styles.css','/admin.css'].includes(req.url)){res.setHeader('Content-Type','text/css');res.end(await readFile(req.url.slice(1)));return}res.setHeader('Content-Type','application/javascript');res.end(await readFile(join(temp,req.url==='/optimizer.js'?'optimizer.js':'image-worker.js')))}catch{res.writeHead(404).end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--no-first-run','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+join(temp,'profile'),'about:blank'],{stdio:'ignore'});
 let port;for(let i=0;i<100;i++){try{port=(await readFile(join(temp,'profile/DevToolsActivePort'),'utf8')).split('\n')[0];break}catch{await new Promise(r=>setTimeout(r,100))}}assert(port,'Chrome debugging port');
 const page=await (await fetch('http://127.0.0.1:'+port+'/json/new?'+encodeURIComponent(origin+'/project/edit/fixture'),{method:'PUT'})).json();
 const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id)}});
 const command=(method,params={})=>new Promise(r=>{const id=++seq;pending.set(id,r);ws.send(JSON.stringify({id,method,params}))});
 for(let i=0;i<100;i++){const r=await command('Runtime.evaluate',{expression:`!!document.querySelector('[data-upload="tab"]')`});if(r.result?.result?.value===true)break;await new Promise(r=>setTimeout(r,50))}
 await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 let shot=await command('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/a45-editor-desktop.png',Buffer.from(shot.result.data,'base64'));
 const run=async expression=>{const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.result.exceptionDetails,JSON.stringify(r.result.exceptionDetails));return r.result.result.value};
 assert(await run('document.documentElement.scrollWidth<=innerWidth'),'desktop no overflow');
 await run(`document.querySelector('[data-action="library"]').click()`);
 shot=await command('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/a45-editor-library.png',Buffer.from(shot.result.data,'base64'));
 assert.equal(await run('document.querySelectorAll(".document-media-card").length'),4);
 await run(`document.querySelector('[data-action="library"]').click();document.querySelector('[data-tab="1"]').click()`);
 assert.equal(await run('document.querySelector("[data-active-tab-label]").textContent'),'Фотографии');
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 assert(await run('document.documentElement.scrollWidth<=innerWidth'),'mobile no overflow');
 shot=await command('Page.captureScreenshot',{format:'png'});await writeFile('/tmp/a45-editor-mobile.png',Buffer.from(shot.result.data,'base64'));
 console.log('PASS: real Chrome desktop/mobile editor, tab context, four-photo library, no horizontal overflow. Screenshots /tmp/a45-editor-{desktop,library,mobile}.png');
 ws.close();
}finally{chrome?.kill();server?.close();await new Promise(r=>setTimeout(r,500));await rm(temp,{recursive:true,force:true})}
