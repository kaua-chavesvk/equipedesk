import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readJson } from '@/lib/http/read-json';
import { failure } from '@/lib/http/api';
import { COOKIE_VERSION } from '@/lib/legal';

export async function POST(request:Request){
  try{
    const {optional}=z.object({optional:z.boolean()}).strict().parse(await readJson(request));
    (await cookies()).set('desk_cookie_choice',`${COOKIE_VERSION}:${optional?'allow':'reject'}`,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:180*86400});
    return NextResponse.json({saved:true});
  }catch(error){return failure(error);}
}
