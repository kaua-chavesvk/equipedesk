import 'server-only';
import type { MfaInput, MfaStatus } from '@/features/security/mfa';
import { HttpError } from '@/lib/http/api';
import { requireAccount } from './account-settings';
import type { supabaseServer } from '@/lib/supabase/server';

type Auth = Pick<Awaited<ReturnType<typeof supabaseServer>>['auth'], 'mfa' | 'getClaims'>;

export function totpQrImage(svgDataUrl: string) {
  const prefix = 'data:image/svg+xml;utf-8,';
  if (!svgDataUrl.startsWith(prefix)) throw new HttpError(503, 'Não foi possível cadastrar o autenticador. Tente novamente.');
  // The SDK wraps raw SVG (including newlines/#) in a data URL. Encode its payload
  // so next/image never parses raw control characters or an SVG fragment as a URL.
  return 'data:image/svg+xml;base64,' + Buffer.from(svgDataUrl.slice(prefix.length), 'utf8').toString('base64');
}

// This endpoint must remain reachable at AAL1 so an administrator can complete MFA.
export async function requirePlatformAdmin() {
  const scope = await requireAccount();
  const { data, error } = await scope.db.from('platform_admins').select('user_id')
    .eq('user_id', scope.user.id).maybeSingle();
  if (error) throw new HttpError(503, 'Não foi possível verificar sua permissão.');
  if (!data) throw new HttpError(403, 'Acesso restrito ao administrador geral.');
  return scope;
}

export async function adminMfaStatus(auth: Auth, userId: string): Promise<MfaStatus> {
  const [{ data, error }, claims] = await Promise.all([auth.mfa.listFactors(), auth.getClaims()]);
  if (error || claims.error || claims.data?.claims.sub !== userId) {
    throw new HttpError(503, 'Não foi possível consultar o segundo fator.');
  }
  return {
    verified: claims.data.claims.aal === 'aal2',
    factors: data.all.filter(factor => factor.factor_type === 'totp')
      .map(factor => ({ id: factor.id, status: factor.status })),
  };
}

export async function changeAdminMfa(auth: Auth, userId: string, input: MfaInput) {
  const current = await adminMfaStatus(auth, userId);
  if (input.action === 'enroll') {
    if (current.factors.length) throw new HttpError(409, 'Confirme ou cancele o autenticador existente antes de continuar.');
    const { data, error } = await auth.mfa.enroll({ factorType: 'totp', friendlyName: 'EquipeDesk' });
    if (error) throw new HttpError(422, 'Não foi possível cadastrar o autenticador. Tente novamente.');
    // Only the explicit enrollment response contains the secret; never persist or log it.
    return { factorId: data.id, qrCode: totpQrImage(data.totp.qr_code), secret: data.totp.secret };
  }
  const factor = current.factors.find(item => item.id === input.factorId);
  if (!factor) throw new HttpError(404, 'Autenticador não encontrado.');
  if (input.action === 'cancel') {
    if (factor.status !== 'unverified') throw new HttpError(403, 'Um autenticador confirmado não pode ser removido por esta tela.');
    const { error } = await auth.mfa.unenroll({ factorId: factor.id });
    if (error) throw new HttpError(422, 'Não foi possível cancelar o cadastro. Tente novamente.');
  } else {
    const { error } = await auth.mfa.challengeAndVerify({ factorId: factor.id, code: input.code });
    if (error) throw new HttpError(422, 'Código inválido ou expirado. Confira o autenticador e tente novamente.');
  }
  return adminMfaStatus(auth, userId);
}
