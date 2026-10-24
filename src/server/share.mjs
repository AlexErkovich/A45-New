import {publicSupabaseConfig} from '../build-config.mjs';
const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid=/^[a-f0-9]{8}-[a-f0-9-]{27}$/i;
export function createShareHandler({env=process.env,request=fetch}={}){
 return async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  if(!['GET','HEAD'].includes(req.method||'GET')){res.statusCode=405;res.setHeader('Allow','GET, HEAD');res.end();return}
  const url=new URL(req.url,'https://a45-new.vercel.app'),raw=String(req.query?.project||url.searchParams.get('project')||'').replace(/\.html$/,'');
  if(!/^[a-zA-Z0-9_-]{1,200}$/.test(raw)){res.statusCode=404;res.end('Проект не найден');return}
  try{const config=publicSupabaseConfig(env);if(!config)throw Error('Configuration unavailable');const origin=new URL(env.PUBLIC_SITE_URL||'https://a45-new.vercel.app').origin,headers={apikey:config.key,...(config.key.startsWith('sb_publishable_')?{}:{Authorization:'Bearer '+config.key})};
   const get=async(path,params)=>{const response=await request(config.url+'/rest/v1/'+path+'?'+new URLSearchParams(params),{headers,signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Source unavailable');return response.json()};
   const selection='id,slug,title,description,status,cover_media_id,project_media!project_media_project_id_fkey(id,path,kind,variants)';
   const projectQuery={select:selection,status:'eq.published',limit:'1',[uuid.test(raw)?'id':'slug']:'eq.'+raw};let projects=await get('projects',projectQuery);
   if(!projects.length&&!uuid.test(raw)){const aliases=await get('project_blocks',{select:'project_id','content->editorMeta->>sourceId':'eq.'+raw,limit:'1'});if(aliases[0])projects=await get('projects',{select:selection,status:'eq.published',id:'eq.'+aliases[0].project_id,limit:'1'})}
   const project=projects.find(row=>row.status==='published');if(!project){res.statusCode=404;res.end('Проект не найден');return}
   const media=project.project_media?.find(row=>row.id===project.cover_media_id),path=media?.variants?.thumbnail||media?.variants?.content;
   const hasCover=path&&path.startsWith(project.id+'/')&&/\/(thumbnail|content)\.webp$/.test(path)&&!path.includes('..');
   if((req.query?.image||url.searchParams.get('image'))==='1'){
    if(!hasCover){res.statusCode=302;res.setHeader('Location',origin+'/assets/logo.png');res.end();return}
    const image=await request(config.url+'/storage/v1/object/authenticated/project-media/'+path.split('/').map(encodeURIComponent).join('/'),{headers,signal:AbortSignal.timeout(10000)});
    if(!image.ok){res.statusCode=404;res.end('Изображение недоступно');return}res.setHeader('Content-Type','image/webp');res.statusCode=200;res.end(req.method==='HEAD'?undefined:Buffer.from(await image.arrayBuffer()));return;
   }
   const params=new URLSearchParams();for(const key of ['tab','category']){const value=url.searchParams.get(key);if(value&&/^[a-zA-Z0-9_-]{1,160}$/.test(value))params.set(key,value)}const route=origin+'/#/project/'+encodeURIComponent(project.slug)+(params.size?'?'+params:'');const share=origin+'/share/'+encodeURIComponent(project.slug)+'.html',image=hasCover?origin+'/api/share?project='+encodeURIComponent(project.slug)+'&image=1':origin+'/assets/logo.png';
   res.setHeader('Content-Type','text/html; charset=utf-8');res.statusCode=200;res.end(req.method==='HEAD'?undefined:`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escape(project.title)} — A45</title><link rel="canonical" href="${escape(share)}"><meta name="description" content="${escape(project.description)}"><meta property="og:type" content="article"><meta property="og:url" content="${escape(share)}"><meta property="og:title" content="${escape(project.title)}"><meta property="og:description" content="${escape(project.description)}"><meta property="og:image" content="${escape(image)}"><meta name="twitter:card" content="summary_large_image"><meta http-equiv="refresh" content="0;url=${escape(route)}"></head><body><a href="${escape(route)}">${escape(project.title)}</a></body></html>`);
  }catch{res.statusCode=503;res.setHeader('Retry-After','30');res.end('Не удалось загрузить проект. Повторите попытку.');}
 };
}
