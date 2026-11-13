import { securityEvent } from '@/lib/security';
import { readJson } from '@/lib/http/read-json';
import { NextResponse } from 'next/server';
import { authInput } from '@/lib/http/auth-input';
import { configured, supabaseServer } from '@/lib/supabase/server';
import { initializeDemo } from '@/lib/data';
import { failure, HttpError } from '@/lib/http/api';

export async function POST(request: Request) {
  try {
    const input = authInput.parse(await readJson(request));
    if (input.action === 'demo') {
      if (configured() || process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
        throw new HttpError(403, 'Demonstração desativada.');
      }
      await initializeDemo();
      return NextResponse.json({ redirect: '/e/aurora' });
    }
    if (!configured()) throw new HttpError(422, 'Configure o Supabase ou use a demonstração.');

    const db = await supabaseServer();
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    let error;
    switch (input.action) {
      case 'logout':
        ({ error } = await db.auth.signOut());
        break;
      case 'recover':
        ({ error } = await db.auth.resetPasswordForEmail(input.email, {
          redirectTo: `${origin}/callback?next=/redefinir-senha`,
        }));
        break;
      case 'update_password': {
        const {data:{user}}=await db.auth.getUser();if(!user)throw new HttpError(401,'Sessão ausente.');
        ({ error } = await db.auth.updateUser({ password: input.password }));
        break;
      }
      case 'signup':
        ({ error } = await db.auth.signUp({
          email: input.email,
          password: input.password,
          options: { data: { name: input.name,legal_terms_accepted:input.termsAccepted,legal_adult_confirmed:input.adultConfirmed,legal_terms_version:input.termsVersion,legal_privacy_version:input.privacyVersion,marketing_consent:input.marketingConsent }, emailRedirectTo: `${origin}/callback` },
        }));
        break;
      case 'login':
        ({ error } = await db.auth.signInWithPassword({ email: input.email, password: input.password }));
        break;
    }
    if(error)securityEvent('auth_failed',422,request.headers.get('x-request-id')??undefined);
    if (error && input.action !== 'recover') throw new HttpError(422, 'Não foi possível autenticar. Confira seus dados e a confirmação do e-mail.');
    return NextResponse.json({
      redirect: input.action === 'logout' ? '/login' : '/onboarding',
      message: input.action === 'recover'
        ? 'Se o e-mail estiver cadastrado, você receberá um link de recuperação.'
        : input.action === 'signup' ? 'Confira seu e-mail para confirmar o cadastro.' : undefined,
    });
  } catch (error) {
    return failure(error);
  }
}
