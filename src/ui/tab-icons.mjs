import {tabKind} from './tab-kind.mjs';
// One mapping for publication tabs and the editor.
export function tabIconName(tab){const title=(tab.title||'').toLocaleLowerCase('ru');if(tabKind(tab)==='documents')return 'document';if(/идея|концепц|обзор/.test(title)||['overview','idea'].includes(tab.key||tab.id))return 'idea';if(tabKind(tab)==='photos')return 'photo';if(/процесс|создани|разработ|этап/.test(title))return 'workflow';return 'file'}
