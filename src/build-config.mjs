export function publicSupabaseConfig(env){
 const url=env.SUPABASE_URL?.trim(),key=(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY)?.trim();
 if(!url&&!key)return null;
 if(!url||!key)throw new Error('Set both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.');
 const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||!['','/'].includes(parsed.pathname))throw new Error('SUPABASE_URL must be an HTTPS project origin.');
 if(key.startsWith('sb_secret_'))throw new Error('Secret Supabase keys must never enter frontend builds.');
 if(!key.startsWith('sb_publishable_')){let claims;try{claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString())}catch{throw new Error('Use a publishable key or legacy anon JWT.')}if(claims.role!=='anon')throw new Error('Only the anon role is allowed in frontend builds.');}
 return {url:parsed.origin,key};
}
