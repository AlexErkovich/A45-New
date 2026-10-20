// Local static preview only: serves dist, with the same /admin mapping as Vercel.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const port=Number(process.env.A45_PREVIEW_PORT||3001);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.mp4':'video/mp4','.zip':'application/zip','.txt':'text/plain; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(['/admin/','/login/'].includes(path)){res.writeHead(302,{Location:path.slice(0,-1)});res.end();return}
  if(path.split('/').some(segment=>segment.startsWith('.'))){res.writeHead(404);res.end();return}
  const file=resolve(root,'.'+((['/', '/admin', '/login'].includes(path)||/^\/project\/(new|drafts|edit\/[^/]+)$/.test(path))?'/index.html':path));
  if(!file.startsWith(resolve(root)+sep)){res.writeHead(404);res.end();return}
  const info=await stat(file);if(!info.isFile()){res.writeHead(404);res.end();return}
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end()}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is in use. Set A45_PREVIEW_PORT to another port.`:error.message);process.exitCode=1});
server.listen(port,'127.0.0.1',()=>console.log(`A45 preview: http://127.0.0.1:${port}/ · login: /login · admin: /admin (dist only)`));
