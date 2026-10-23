import assert from 'node:assert/strict';
import {creationKey,creationClient} from '../src/creation-mode.mjs';
import {createCategoryService} from '../src/category-service.mjs';
const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};let generated=0;
const key=creationKey(storage,()=>{generated++;return 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});assert.equal(key.length,72);assert.equal(creationKey(storage),key);assert.equal(generated,2,'browser key survives reloads');
const calls=[],client={auth:{getUser(){throw Error('Login must not be required')}},storage:{from(){return {}}},rpc(name,args){calls.push({name,args});return Promise.resolve({data:true})}};
const wrapped=creationClient(client);const service=createCategoryService(wrapped,{creationMode:true});assert.equal(await service.isAdmin(true),true);
for(const [name,alias] of [['create_a45_category','a45_open_create_category'],['publish_a45_category','a45_open_publish_category'],['save_a45_project','a45_open_save_project'],['other','other']]){await wrapped.rpc(name,{doc:{title:'Тест'}});assert.equal(calls.at(-1).name,alias)}
assert.equal(wrapped.storage,client.storage);console.log('PASS: creation without Auth calls, stable browser key, scoped server RPC aliases and unchanged file storage.');

const adminCalls=[];const adminClient={auth:{async getSession(){return {data:{session:{user:{id:'admin'}}}}}},async rpc(name){adminCalls.push(name);return {data:true}}};await creationClient(adminClient).rpc('save_a45_project',{doc:{id:'existing'}});assert.deepEqual(adminCalls,['is_a45_admin','save_a45_project']);console.log('PASS: authenticated admin uses original save RPC instead of creation-only ownership.');
