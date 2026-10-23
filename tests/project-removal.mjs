import assert from 'node:assert/strict';
import {removeProject} from '../src/project-removal.mjs';
const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},projects=[{id:'foreign'}];let writes=0;
const service={async get(){return {id:'foreign',status:'published'}},async save(){writes++;throw Error('This item belongs to another browser')}};
const result=await removeProject({id:'foreign',service,storage,projects});assert(result.localOnly);assert.deepEqual(JSON.parse(data.get('a45-hidden-projects')),['foreign']);assert.equal(projects.length,1);await result.restore();assert.deepEqual(JSON.parse(data.get('a45-hidden-projects')),[]);
service.save=async()=>{throw Error('Нет сети')};await assert.rejects(removeProject({id:'foreign',service,storage,projects}),/Нет сети/);assert.deepEqual(JSON.parse(data.get('a45-hidden-projects')),[]);
console.log('PASS: foreign records remain protected; local removal and restore work; network errors do not hide records.');
