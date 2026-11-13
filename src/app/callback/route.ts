import { safeRedirect } from '@/lib/safe-redirect';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
export async function GET(request:Request){const url=new URL(request.url);const code=url.searchParams.get('code');const next=url.searchParams.get('next')??'/onboarding';if(code){const db=await supabaseServer();const {error}=await db.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(safeRedirect(next),url.origin));}return NextResponse.redirect(new URL('/login?erro=callback',url.origin));}

