// The public view never inherits the persisted administrator session or its RLS role.
export function createPublicClient(createClient,config){
 return config?createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'a45-public-readonly'}}):null;
}
