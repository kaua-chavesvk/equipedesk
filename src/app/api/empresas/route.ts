import { readJson } from '@/lib/http/read-json';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { demoEnabled,demoStore } from '@/lib/data';
import { supabaseServer } from '@/lib/supabase/server';
import { failure } from '@/lib/http/api';
export async function POST(request:Request){try{const input=z.object({name:z.string().trim().min(2).max(100),slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(60)}).strict().parse(await readJson(request));if(demoEnabled()){const store=await demoStore();if(store.organizations.some(o=>o.slug===input.slug))return NextResponse.json({error:'Este endereço já está em uso.'},{status:409});const org={...input,id:randomUUID(),role:'admin' as const};store.organizations.push(org);return NextResponse.json(org,{status:201});}const db=await supabaseServer();const {data,error}=await db.rpc('desk_command',{p_slug:'',p_action:'create_organization',p_payload:input});if(error)throw new Error(error.message);return NextResponse.json(data,{status:201});}catch(error){return failure(error);}}
