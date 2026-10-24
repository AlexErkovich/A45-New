import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url),read=name=>readFile(new URL(name,root),'utf8');
const tokens=await read('design-tokens.css');
const definitions=new Map([...tokens.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
assert.equal(definitions.get('--color-accent'),'#ed5938');assert.equal(definitions.get('--ui-button-height'),'40px');assert.equal(definitions.get('--menu-width'),'230px');assert.equal(definitions.get('--media-width'),'1230px');assert.equal(definitions.get('--media-columns'),'minmax(0,2.05fr) minmax(0,1fr)');
async function cssFiles(directory=''){let files=[];for(const entry of await readdir(new URL(directory||'./',root),{withFileTypes:true})){const name=directory+entry.name;if(entry.isFile()&&name.endsWith('.css'))files.push(name);else if(entry.isDirectory()&&name==='src')files.push(...await cssFiles(name+'/'));else if(entry.isDirectory()&&directory.startsWith('src/'))files.push(...await cssFiles(name+'/'))}return files}
for(const file of await cssFiles()){if(file==='design-tokens.css')continue;const css=(await read(file)).replace(/\/\*[\s\S]*?\*\//g,'');assert(!/#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/i.test(css),`${file}: colors belong in design-tokens.css`);assert(!/\b(?:color|background(?:-color)?|border(?:-color)?)\s*:[^;{}]*\b(?:white|black)\b/i.test(css),`${file}: use a color token`)}
const html=await read('index.html');const styles=[...html.matchAll(/rel="stylesheet" href="([^"?]+)/g)].map(m=>m[1]).filter(s=>!s.startsWith('https:'));assert.equal(styles[0],'design-tokens.css','tokens load before all component/page styles');assert((await read('scripts/build.mjs')).includes("'design-tokens.css'"));
const admin=await read('admin.css');assert(admin.includes('padding:var(--dialog-form-padding)'));assert(admin.includes('padding:var(--dialog-sm-padding)'));
const ui=await read('ui.css');assert(ui.includes('height:var(--ui-button-height)'));assert(ui.includes('width:var(--menu-width)'));assert(ui.includes('width:min(var(--media-width),90vw)'));
for(const source of ['project-page.js','src/project-editor-view.mjs','src/project-editor.mjs'])assert((await read(source)).includes('ui-action-menu'),`${source}: use shared action menus`);
const rules=await read('AGENTS.md');assert(rules.includes('design-tokens.css'));assert(rules.includes('docs/DESIGN-SYSTEM.md'));assert((await read('scripts/generate-icons.mjs')).includes("from 'lucide-react'"));
console.log('PASS: centralized UI colors, token load/build order, shared button/menu/media metrics and persistent component rules.');
