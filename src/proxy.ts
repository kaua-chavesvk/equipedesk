import { boundedSupabaseFetch } from '@/lib/supabase/fetch';
import { LEGAL_VERSION } from '@/lib/legal';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { allowedMutation, contentSecurityPolicy, environmentProblems, production, securityEvent } from '@/lib/security';
import { rateLimit } from '@/lib/rate-limit';

export async function proxy(request: NextRequest) {
  const prod=production(), id=crypto.randomUUID();
  const nonce=Buffer.from(crypto.randomUUID()).toString('base64');
  const csp=contentSecurityPolicy(nonce,prod);
  const headers=new Headers(request.headers);
  headers.set('x-request-id',id);
  headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',csp);
  const finish=(response:NextResponse)=>{
    response.headers.set('Content-Security-Policy',csp);
    response.headers.set('X-Request-Id',id);
    response.headers.set('Cache-Control','private, no-store');
    return response;
  };
  const deny=(status:number,event:string,message:string)=>{
    securityEvent(event,status,id);
    return finish(NextResponse.json({error:message},{status}));
  };
  if(environmentProblems(process.env, {requireRedis:false}).length) return deny(503,'environment_invalid','Serviço temporariamente indisponível.');
  const site=process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const path=request.nextUrl.pathname;
  if(prod){
    const protocol=process.env.TRUST_PROXY==='true'?request.headers.get('x-forwarded-proto')??request.nextUrl.protocol.replace(':',''):request.nextUrl.protocol.replace(':','');
    if(protocol!=='https')return finish(NextResponse.redirect(new URL(path+request.nextUrl.search,site),308));
  }
  if(/\/(?:\.env(?:\.[^/]*)?|\.git|\.tools|node_modules)(?:\/|$)|\.(?:sql|map|bak|log)$/i.test(path))return deny(404,'private_path','Recurso não encontrado.');
  if(path.startsWith('/api/')){
    const mutating=!['GET','HEAD','OPTIONS'].includes(request.method);
    if(mutating&&!allowedMutation(request,site,prod))return deny(403,'csrf_rejected','Origem da requisição não permitida.');
    if(request.method==='OPTIONS')return finish(new NextResponse(null,{status:405}));
    if(mutating&&request.method!=='DELETE'&&request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return deny(415,'unsupported_media','Envie os dados em JSON. Arquivos não são aceitos.');
    if(Number(request.headers.get('content-length')??0)>32768)return deny(413,'body_too_large','Requisição muito grande. Limite de 32 KiB.');
    try { if(!await rateLimit(request)){
      const response=deny(429,'rate_limit','Muitas requisições. Aguarde um minuto.');response.headers.set('Retry-After','60');return response;
    }}catch{
      if(mutating || path==='/api/auth')return deny(503,'rate_limit_unavailable','Serviço temporariamente indisponível.');
      securityEvent('rate_limit_read_degraded',200,id);
    }
  }
  let response=NextResponse.next({request:{headers}});
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY){
    if(!request.cookies.has('desk_demo')&&(!prod||process.env.DEMO_MODE==='true')){
      const value=crypto.randomUUID();request.cookies.set('desk_demo',value);
      headers.set('cookie',request.cookies.toString());
      response=NextResponse.next({request:{headers}});
      response.cookies.set('desk_demo',value,{httpOnly:true,sameSite:'lax',secure:prod,path:'/'});
    }
    return finish(response);
  }
  const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{
    global:{fetch:boundedSupabaseFetch},
    cookieOptions:{httpOnly:true,secure:prod,sameSite:'lax',path:'/'},
    cookies:{getAll:()=>request.cookies.getAll(),setAll(values){
      values.forEach(({name,value})=>request.cookies.set(name,value));
      headers.set('cookie',request.cookies.toString());
      response=NextResponse.next({request:{headers}});
      values.forEach(({name,value,options})=>response.cookies.set(name,value,{...options,httpOnly:true,secure:prod,sameSite:'lax',path:'/'}));
    }},
  });
  try{
    const {data:{user}}=await client.auth.getUser();
    if(!user&&(path.startsWith('/e/')||path==='/onboarding'||path==='/redefinir-senha')){
      const target=new URL('/login',site);target.searchParams.set('next',path);
      const redirect=NextResponse.redirect(target);response.cookies.getAll().forEach(cookie=>redirect.cookies.set(cookie));return finish(redirect);
    }
    if(user&&(path.startsWith('/e/')||path==='/onboarding'||path.startsWith('/api/empresas')||path.startsWith('/api/convites/aceitar'))){
      const {data,error}=await client.from('legal_acceptances').select('id').eq('user_id',user.id).eq('kind','terms').eq('terms_version',LEGAL_VERSION).eq('privacy_version',LEGAL_VERSION).eq('adult_confirmed',true).limit(1);
      if(error)return deny(503,'legal_registry_unavailable','Serviço temporariamente indisponível.');
      if(!data?.length){if(path.startsWith('/api/'))return deny(403,'terms_required','Leia e aceite os termos atuais antes de continuar.');const target=NextResponse.redirect(new URL('/aceitar-termos',site));response.cookies.getAll().forEach(cookie=>target.cookies.set(cookie));return finish(target);}
    }
  }catch{return deny(503,'auth_unavailable','Serviço temporariamente indisponível.');}
  return finish(response);
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
