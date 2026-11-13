import { InviteAcceptance } from '@/components/invite-acceptance';
import { configured, supabaseServer } from '@/lib/supabase/server';

const previewErrors: Record<string, string> = {
  invalid: 'Convite inválido ou enviado para outro e-mail.',
  used: 'Este convite já foi utilizado.',
  revoked: 'Este convite foi cancelado.',
  expired: 'Este convite expirou. Peça um novo link à equipe.',
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!configured()) return <InviteAcceptance token={token} />;

  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return <InviteAcceptance token={token} loginRequired />;

  const { data, error } = await db.rpc('invite_preview', { p_token: token });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    return <InviteAcceptance token={token} unavailable="Não foi possível conferir o convite. Recarregue a página para tentar novamente." />;
  }

  if (data.status === 'valid' && typeof data.company === 'string' && typeof data.role === 'string') {
    return <InviteAcceptance token={token} company={data.company} role={data.role} />;
  }

  return <InviteAcceptance token={token} unavailable={previewErrors[String(data.status)] ?? previewErrors.invalid} />;
}
