import {isDocumentsTab} from './document-types.mjs';
// One resolver for hydration, creation, rendering and serialization. Explicit media kinds survive renaming.
export function tabKind(tab){
 if(isDocumentsTab(tab))return 'documents';
 if(tab.kind==='photos'||/фото|photo/i.test(tab.title||''))return 'photos';
 return 'text';
}
