import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer, configured } from '@/lib/supabase/server';
import { readJson } from '@/lib/http/read-json';
import { HttpError, failure } from '@/lib/http/api';
export async function POST(request:Request){
  try{
    const {token}=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(await readJson(request));
    if(!configured())throw new HttpError(422,'Não há campanhas reais nesta demonstração.');
    const db=await supabaseServer();const {error}=await db.rpc('unsubscribe_marketing',{p_token:token});
    if(error)throw new Error('Não foi possível atualizar a preferência.');
    return NextResponse.json({message:'Se o link estava ativo, o consentimento de marketing foi revogado.'});
  }catch(error){return failure(error);}
}
