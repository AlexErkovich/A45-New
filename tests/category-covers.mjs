import assert from 'node:assert/strict';
import {categoryCoverPath,visibleCategory} from '../src/category-covers.mjs';
for(const [id,path] of [['photography','photography/40733d9e-c410-4919-9fdb-398154011a30.webp'],['video','video/9c24c1be-1e21-4a0e-a2cf-b0d25064ef47.webp']]){
 const row={id,cover_image_path:path,title:'Название',parent_id:null};assert.equal(categoryCoverPath(row),path);assert.deepEqual(visibleCategory(row),row);assert.equal(row.cover_image_path,path,'source metadata stays intact');assert.equal(categoryCoverPath({...row,cover_image_path:id+'/new.webp'}),id+'/new.webp');
}
assert.equal(categoryCoverPath({id:'garden',cover_image_path:'garden/cover.webp'}),'garden/cover.webp');assert.equal(categoryCoverPath(null),null);
console.log('PASS: all stored covers are honored without path-specific suppression.');
