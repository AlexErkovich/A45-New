import {createProjectEditor} from '../src/project-editor.mjs';
import {newProject,newTab,uid} from '../src/project-model.mjs';
window.archiveData={categories:[{id:'technical',parentId:null,title:'Техническое творчество',sortOrder:0},{id:'photography',parentId:null,title:'Фотография',sortOrder:1}],projects:[]};
const doc=newProject('photography');doc.title='Летние наблюдения';doc.description='Заметки, фотографии и маленькие открытия в пути.';doc.revision=1;doc.tabs.push(newTab('Фотографии'),newTab('История'));
doc.tabs[0].blocks=[{id:uid(),type:'TEXT',content:{text:'Каждый проект начинается с наблюдения. Здесь можно собрать историю, добавить фотографии и постепенно превратить заметки в публикацию.'}}];
const urls={};for(let i=0;i<4;i++){const id=uid();doc.media.push({id,name:'summer-'+(i+1)+'.jpg',kind:'image',mimeType:'image/jpeg',size:1000});urls[id]='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" fill="${['#a4b3a0','#c8baa3','#8e9a9c','#b6b29b'][i]}"/><path d="M0 380 L180 120 L340 320 L500 180 L600 400 V450 H0Z" fill="#ffffff55"/><circle cx="460" cy="95" r="34" fill="#ffffff99"/></svg>`)}
doc.tabs[1].blocks=[{id:uid(),type:'GALLERY',content:{items:doc.media.slice(0,3).map(m=>({mediaId:m.id,caption:''}))}}];
window.confirm=()=>true;window.A45Archive={preview(p,target){target.innerHTML='<h1>'+p.title+'</h1><p>'+p.description+'</p>'}};
let persisted=structuredClone(doc);const service={async isAdmin(){return true},async get(){return structuredClone(persisted)},async list(){return [persisted]},async mediaUrls(){return urls},async save(d,pending,status){d.status=status;d.revision++;pending.clear();persisted=structuredClone(d)}};
window.editor=createProjectEditor({service,categoryService:service,visual:{state:{}},refresh:async()=>{}});window.editor.start();window.editor.mount();
