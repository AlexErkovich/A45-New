// Same process static server, ephemeral localhost port; no browser, child process, or cloud request.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {get} from 'node:http';
process.env.A45_PREVIEW_PORT='0';
const {server}=await import('../scripts/preview.mjs');
if(!server.listening)await once(server,'listening');
const port=server.address().port;
async function request(path){return new Promise((resolve,reject)=>{const req=get({hostname:'127.0.0.1',port,path,headers:{Connection:'close'}},response=>{const chunks=[];let bytes=0;response.on('data',chunk=>{bytes+=chunk.length;if(bytes>16384){req.destroy(Error('Unexpectedly large route response'));return}chunks.push(chunk)});response.on('end',()=>resolve({status:response.statusCode,location:response.headers.location,body:Buffer.concat(chunks).toString()}))});req.setTimeout(1500,()=>req.destroy(Error('Local route timeout')));req.on('error',reject)})}
try{
 let html;
 for(const route of ['/','/login','/admin']){const result=await request(route);assert.equal(result.status,200,route+' HTTP status');assert(result.body.includes('id="main"'));if(html)assert.equal(result.body===html,true,'one shared HTML application');html=result.body}
 for(const route of ['/.env.local','/.git/config','/package.json','/AGENTS.md'])assert.equal((await request(route)).status,404,'private source/config not served');
 const legacy=await request('/project/drafts');assert.equal(legacy.status,307);assert.equal(legacy.location,'/admin#/drafts');
 console.log('PASS: real local HTTP /, /login, /admin return one shared production HTML; legacy drafts enter admin; private configuration/source unavailable. No browser/cloud requests.');
}finally{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
