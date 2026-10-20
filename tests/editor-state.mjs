import assert from 'node:assert/strict';
import { createEditorState } from '../src/editor-state.mjs';
const row=id=>({id,title:id,description:'Original',cover_image_path:null,updated_at:'v1'});
let calls=[],failedId=null;const revoked=[];
const service={async save(base,patch){calls.push(base.id);if(base.id===failedId)throw new Error('Network error');return {category:{...base,title:patch.title.trim(),description:patch.description,updated_at:'v2'},warning:''}}};
const e=createEditorState(service,{revoke:url=>revoked.push(url)});e.hydrate([row('one'),row('two')]);assert.throws(()=>e.enter());e.authorize(true);assert(!e.state.editing);e.enter();
e.patch('one',{title:'Draft'});assert(e.dirty);assert.equal(calls.length,0);assert.equal(e.effective('one').title,'Draft');assert.equal(e.state.rows.get('one').title,'one');assert.throws(()=>e.exit());
e.preview();assert.throws(()=>e.patch('one',{title:'No'}));assert.equal(e.effective('one').title,'Draft');e.preview();
e.patch('two',{description:'Draft 2'});failedId='two';assert.equal(await e.save(),false);assert.deepEqual(calls,['one','two']);assert(!e.state.drafts.has('one'));assert(e.state.drafts.has('two'));assert.equal(e.state.rows.get('one').title,'Draft');assert(e.state.message.includes('Сохранено 1 из 2'));
// Public refresh never changes the optimistic base of an existing draft.
e.hydrate([{...row('two'),updated_at:'external'}]);assert.equal(e.state.drafts.get('two').base.updated_at,'v1');
failedId=null;assert(await e.save());assert(!e.dirty);assert.equal(e.state.rows.get('two').description,'Draft 2');
e.patch('one',{blob:new Blob(['photo']),imageUrl:'blob:first'});e.patch('one',{blob:new Blob(['other']),imageUrl:'blob:second'});assert.deepEqual(revoked,['blob:first']);e.authorize(false);assert(e.dirty);assert.equal(e.effective('one').imageUrl,'blob:second');await assert.rejects(e.save());
e.authorize(true);e.discard();assert(revoked.includes('blob:second'));e.exit();assert(!e.state.editing);
e.enter();e.patch('one',{title:''});const n=calls.length;assert.equal(await e.save(),false);assert.equal(calls.length,n);assert(e.dirty);e.discard();e.patch('one',{title:e.state.rows.get('one').title});assert(!e.dirty);
console.log('PASS: explicit edit mode, memory-only drafts, preview, validation, partial save/retry, conflict base, auth loss, and blob cleanup.');
