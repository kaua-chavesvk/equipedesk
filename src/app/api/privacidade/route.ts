import { observeApi } from '@/lib/http/observe-api';
import { NextResponse } from 'next/server';
import { supabaseServer, configured } from '@/lib/supabase/server';
import { failure, HttpError } from '@/lib/http/api';
import { readJson } from '@/lib/http/read-json';
import { privacyInput } from '@/lib/privacy-input';
import type { Json } from '@/lib/supabase/database.types';

async function session(){
  if(!configured())throw new HttpError(422,'A demonstração não registra pedidos ou aceites reais. Use o canal de privacidade para atendimento.');
  const db=await supabaseServer();const {data:{user},error}=await db.auth.getUser();
  if(error||!user)throw new HttpError(401,'Sessão ausente.');
  return {db,user};
}
async function handleGET(){
  try{
    const {db,user}=await session();
    const [acceptances,preferences,requests]=await Promise.all([
      db.from('legal_acceptances').select('id,kind,terms_version,privacy_version,terms_digest,privacy_digest,adult_confirmed,recorded_at,source').eq('user_id',user.id).order('recorded_at',{ascending:false}).limit(100),
      db.from('privacy_preferences').select('marketing,updated_at').eq('user_id',user.id).maybeSingle(),
      db.from('privacy_requests').select('id,kind,status,details,response,created_at,due_at,completed_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100),
    ]);
    if(acceptances.error||preferences.error||requests.error)throw acceptances.error??preferences.error??requests.error;
    return NextResponse.json({account:{id:user.id,email:user.email,name:user.user_metadata.name??''},acceptances:acceptances.data,marketing:preferences.data?.marketing??false,requests:requests.data,scope:'Resumo da conta e até 100 registros de cada categoria. Solicite acesso completo para incluir dados de chamados e dados sob responsabilidade da empresa.'});
  }catch(error){return failure(error);}
}
async function handlePOST(request:Request){
  try{
    const input=privacyInput.parse(await readJson(request));
    const {db}=await session();const {action,...payload}=input;
    const {data,error}=await db.rpc('privacy_command',{p_action:action,p_payload:payload as Json});
    if(error)throw new Error(error.message);
    return NextResponse.json(data,{status:action==='request'?201:200});
  }catch(error){return failure(error);}
}

export const GET = observeApi('/api/privacidade', handleGET);

export const POST = observeApi('/api/privacidade', handlePOST);
