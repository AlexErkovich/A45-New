// Temporary server creation uses a browser key, without an account or administrator role.
export function creationKey(storage,randomUUID=()=>crypto.randomUUID()){
 const name='a45-creation-key';let key=storage.getItem(name);
 if(!/^[a-f0-9-]{72}$/.test(key||'')){key=randomUUID()+randomUUID();storage.setItem(name,key)}
 return key;
}
export function creationClient(client){
 const aliases={create_a45_category:'a45_open_create_category',publish_a45_category:'a45_open_publish_category',save_a45_project:'a45_open_save_project'};
 return new Proxy(client,{get(target,key){if(key==='rpc')return async(name,args)=>{if(aliases[name]&&target.auth?.getSession){const {data}=await target.auth.getSession();if(data?.session){const admin=await target.rpc('is_a45_admin');if(admin.error)throw admin.error;if(admin.data===true)return target.rpc(name,args)}}return target.rpc(aliases[name]||name,args)};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value}});
}
