import Link from 'next/link';
import { legalIdentity, LEGAL_VERSION } from '@/lib/legal';

export function LegalShell({title,children}:{title:string;children:React.ReactNode}){
  const identity=legalIdentity();
  return <main className="legal-page"><Link href="/login">← Voltar ao acesso</Link><h1>{title}</h1><p>Versão {LEGAL_VERSION}. Texto aplicável às funcionalidades descritas nesta versão.</p>
    <section aria-label="Identificação do responsável"><h2>Responsável e contato</h2>
      {identity.name&&identity.email?<><p>{identity.name}</p><p>Canal de privacidade: <a href={`mailto:${identity.email}`}>{identity.email}</a></p>{identity.cnpj&&<p>CNPJ: {identity.cnpj}</p>}{identity.address&&<p>Endereço: {identity.address}</p>}</>:<p role="status">Identificação e contato público em configuração. O cadastro real permanece indisponível até o preenchimento dessas informações. Nenhum encarregado ou CNPJ foi presumido.</p>}
    </section>{children}
  </main>;
}
