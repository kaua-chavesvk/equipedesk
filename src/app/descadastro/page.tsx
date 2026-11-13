import Link from 'next/link';
import { LegalShell } from '@/components/legal-shell';
export default function Page(){return <LegalShell title="Descadastro de marketing"><p>Não há campanhas ativas nesta versão. Você pode revogar sua preferência de marketing em <Link href="/meus-dados">Meus dados</Link>, depois de entrar na conta, ou pelo canal de privacidade acima. A revogação não impede mensagens necessárias ao acesso e à segurança da conta.</p></LegalShell>}
