import { redirect, notFound } from 'next/navigation';
import { configured, supabaseServer } from '@/lib/supabase/server';
import { LegalShell } from '@/components/legal-shell';
import { PrivacyAdmin } from '@/components/privacy-admin';
import { hasAdminAssurance } from '@/lib/server/admin-assurance';
import Link from 'next/link';
import { serverTranslations } from '@/features/i18n/server';
export default async function Page(){
 if(!configured())return <LegalShell title="Atendimento de privacidade"><p>A demonstração não contém pedidos reais. Conecte o Supabase para usar a fila.</p></LegalShell>;
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
 const {data:admin,error}=await db.from('platform_admins').select('user_id').eq('user_id',user.id).maybeSingle();if(error)throw error;if(!admin)notFound();
 if(!await hasAdminAssurance(db.auth,user.id)) { const t=await serverTranslations();return <LegalShell title="Atendimento de privacidade"><p role="alert">{t('Confirme o segundo fator para acessar a administração.')}</p><Link className="button primary" href="/conta/seguranca">{t('Confirmar segundo fator')}</Link></LegalShell>; }
 const {data,error:requestError}=await db.from('privacy_requests').select('id,kind,details,status,created_at,due_at,response').order('created_at',{ascending:false}).limit(100);if(requestError)throw requestError;
 return <LegalShell title="Atendimento de privacidade"><p>Fila restrita ao administrador geral. Consulte o procedimento de direitos do titular antes de registrar uma conclusão. A consulta mostra os 100 pedidos mais recentes.</p><PrivacyAdmin items={data??[]}/></LegalShell>;
}
