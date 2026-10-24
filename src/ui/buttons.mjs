import {escape as e} from '../project-model.mjs';
import {icons} from './icons.mjs';
// All text actions use these two variants; icon-only controls remain iconButton().
export function actionButton({label,variant='outline',iconName,type='button',href,attributes='',className=''}){
 const tag=href!==undefined?'a':'button';return `<${tag} class="ui-button ui-button--${variant==='primary'?'primary':'outline'} ${e(className)}" ${tag==='a'?`href="${e(href)}"`:`type="${e(type)}"`} ${attributes}>${iconName?icons[iconName]:''}<span>${e(label)}</span></${tag}>`;
}
