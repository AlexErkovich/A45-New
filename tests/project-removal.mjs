import assert from 'node:assert/strict';
import {removeProject} from '../src/project-removal.mjs';
const projects=[{id:'project'}],doc={id:'project',status:'published'};let status='published';
const service={async get(){return doc},async save(d,p,next){status=next;d.status=next}};
const result=await removeProject({id:doc.id,service,projects});assert.equal(status,'draft');assert.equal(projects.length,0);await result.restore();assert.equal(status,'published');assert.equal(projects.length,1);
for(const message of ['Нет сети','This item belongs to another browser']){service.save=async()=>{throw Error(message)};await assert.rejects(removeProject({id:doc.id,service,projects}),e=>e.message===message);assert.equal(projects.length,1)}
console.log('PASS: server archive/restore round-trip; denied and failed writes never hide projects locally.');
