import assert from 'node:assert/strict';
import { cropRect,validateImage,createCategoryService,MAX_IMAGE_BYTES } from '../src/category-service.mjs';
import { publicSupabaseConfig } from '../src/build-config.mjs';
assert.equal(publicSupabaseConfig({}),null);
assert.throws(()=>publicSupabaseConfig({SUPABASE_URL:'https://example.invalid'}));
assert.throws(()=>publicSupabaseConfig({SUPABASE_URL:'https://example.invalid',SUPABASE_PUBLISHABLE_KEY:'sb_secret_not-a-real-key'}));
const jwt=role=>'header.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
assert.throws(()=>publicSupabaseConfig({SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:jwt('service_role')}));
assert.equal(publicSupabaseConfig({SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:jwt('anon')}).url,'https://example.invalid');
for(const [w,h] of [[4000,3000],[3000,4000],[900,200],[200,900]])for(const zoom of [1,1.5,3])for(const x of [0,.5,1])for(const y of [0,.5,1]){const c=cropRect(w,h,zoom,x,y);assert(Math.abs(c.sw/c.sh-4/3)<1e-10);assert(c.sx>=0&&c.sy>=0&&c.sx+c.sw<=w+.001&&c.sy+c.sh<=h+.001)}
for(const [type,bytes] of [['image/jpeg',[255,216,255,0]],['image/png',[137,80,78,71,13,10,26,10]],['image/webp',[82,73,70,70,0,0,0,0,87,69,66,80]]])await validateImage(new Blob([new Uint8Array(bytes)],{type}));
await assert.rejects(validateImage(new Blob(['fake image'],{type:'image/png'})));
await assert.rejects(validateImage(new Blob(['<svg/>'],{type:'image/svg+xml'})));
await assert.rejects(validateImage(new Blob([new Uint8Array(MAX_IMAGE_BYTES+1)],{type:'image/jpeg'})));
function mock({admin=true,failUpdate=false,failCleanup=false,throwCleanup=false}={}){
 const calls=[];const old={id:'photography',cover_image_path:'photography/old.webp',updated_at:'old'};let payload;
 const storage={getPublicUrl:path=>({data:{publicUrl:'https://example.invalid/'+path}}),upload:async(path,blob,options)=>{calls.push(['upload',path,options]);return {}},remove:async paths=>{calls.push(['remove',paths]);if(throwCleanup)throw new Error('offline');return {error:failCleanup?new Error('offline'):null}}};
 const query={update(data){calls.push(['update',data]);payload=data;return query},eq(){return query},select(){return query},async single(){return failUpdate?{error:new Error('conflict')}:{data:{...old,...payload,updated_at:'new'}}}};
 const client={auth:{getUser:async()=>({data:{user:{id:'user'}}})},rpc:async()=>({data:admin}),storage:{from:()=>storage},from:()=>query};
 return {service:createCategoryService(client),calls,old};
}
const blob=new Blob([new Uint8Array([255,216,255])],{type:'image/jpeg'});
const denied=mock({admin:false});await assert.rejects(denied.service.save(denied.old,{title:'Test',description:'',blob}));assert.equal(denied.calls.length,0);
const success=mock();const saved=await success.service.save(success.old,{title:'  Фото  ',description:'New',blob,cleanupPrevious:true});assert.equal(saved.category.title,'Фото');assert.equal(success.calls[0][0],'upload');assert.equal(success.calls[1][0],'update');assert.equal(success.calls[2][0],'remove');assert.equal(success.calls[0][2].upsert,false);assert(success.calls[0][1].startsWith('photography/'));assert(success.calls[0][1].endsWith('.jpg'));
const conflict=mock({failUpdate:true});await assert.rejects(conflict.service.save(conflict.old,{title:'Photo',description:'',blob}));assert(!conflict.calls.some(c=>c[0]==='remove'),'never delete after ambiguous DB failure');
const cleanup=mock({failCleanup:true});assert((await cleanup.service.save(cleanup.old,{title:'Photo',description:'',blob,cleanupPrevious:true})).warning);
const textOnly=mock();await textOnly.service.save(textOnly.old,{title:'Photo',description:'Text'});assert.deepEqual(textOnly.calls.map(c=>c[0]),['update']);
console.log('PASS: frontend config rejects secret keys, crop geometry, image signatures/size, admin gate, unique uploads, optimistic save order, safe failure and cleanup behavior.');

const thrownCleanup=mock({throwCleanup:true});assert((await thrownCleanup.service.save(thrownCleanup.old,{title:'Photo',description:'',blob,cleanupPrevious:true})).warning);
assert(Number.isFinite(cropRect(1000,800,1,'invalid','invalid').sx));
console.log('PASS: post-save cleanup network errors remain warnings; malformed crop position is normalized.');

const retain=mock();await retain.service.save(retain.old,{title:'Photo',description:'',blob});assert(!retain.calls.some(c=>c[0]==='remove'));console.log('PASS: normal cover replacement preserves previously uploaded files.');
