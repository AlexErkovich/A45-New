// Drafts live only in this tab's memory. Only explicit save() calls write to Supabase.
export function createEditorState(service,{changed=()=>{},revoke=()=>{}}={}){
 const state={authorized:false,editing:false,preview:false,saving:false,message:'',error:false,rows:new Map(),drafts:new Map()};
 const emit=()=>changed(state);
 function release(draft){if(draft?.imageUrl)revoke(draft.imageUrl)}
 const editor={state,
  get dirty(){return state.drafts.size>0},
  hydrate(rows){for(const row of rows)state.rows.set(row.id,{...row});emit()},
  authorize(value){state.authorized=!!value;if(!value&&!editor.dirty){state.editing=false;state.preview=false}emit()},
  enter(){if(!state.authorized||state.saving)throw new Error('Нужны права администратора.');state.editing=true;state.preview=false;state.message='';emit()},
  preview(){if(!state.editing||state.saving)return;state.preview=!state.preview;emit()},
  patch(id,patch){if(!state.authorized||!state.editing||state.preview||state.saving)throw new Error('Редактирование недоступно.');const base=state.rows.get(id);if(!base)throw new Error('Категория ещё не загружена.');let draft=state.drafts.get(id);if(!draft)draft={base:{...base},title:base.title,description:base.description,blob:null,imageUrl:null};
   if(patch.imageUrl&&patch.imageUrl!==draft.imageUrl)release(draft);Object.assign(draft,patch);state.drafts.set(id,draft);
   if(!draft.blob&&draft.title===draft.base.title&&draft.description===draft.base.description){release(draft);state.drafts.delete(id)}state.message='';state.error=false;emit();
  },
  effective(id){const base=state.rows.get(id),draft=state.drafts.get(id);return draft?{...base,title:draft.title,description:draft.description,imageUrl:draft.imageUrl}:base},
  exit(){if(editor.dirty)throw new Error('Сначала сохраните или отмените изменения.');state.editing=false;state.preview=false;state.message='';emit()},
  discard(){if(state.saving)return;for(const d of state.drafts.values())release(d);state.drafts.clear();state.message='Изменения отменены.';state.error=false;emit()},
  async save(){if(state.saving)return false;if(!state.authorized)throw new Error('Войдите администратором, чтобы сохранить черновик.');if(!editor.dirty)return true;
   // Validate all text before the first upload; partial failures keep remaining drafts.
   for(const d of state.drafts.values()){if(!d.title.trim()||d.title.trim().length>160||d.description.length>4000){state.error=true;state.message='Название: 1–160 символов, описание: до 4000 символов.';emit();return false}}
   state.saving=true;state.error=false;state.message='Сохранение…';emit();let saved=0;const total=state.drafts.size;const warnings=[];
   try{for(const [id,draft] of [...state.drafts]){const result=await service.save(draft.base,{title:draft.title,description:draft.description,blob:draft.blob});state.rows.set(id,{...result.category});state.drafts.delete(id);release(draft);if(result.warning)warnings.push(result.warning);saved++}
    state.message=warnings.length?'Изменения сохранены. '+warnings.join(' '):'Все изменения сохранены.';return true;
   }catch(error){state.error=true;state.message=`Сохранено ${saved} из ${total}. ${error.message||'Ошибка соединения.'} Несохранённые изменения остаются в редакторе.`;return false}
   finally{state.saving=false;emit()}
  }
 };return editor;
}
