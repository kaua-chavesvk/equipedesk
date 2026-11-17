import Link from 'next/link';
import { legalIdentity, LEGAL_VERSION } from '@/lib/legal';
import { requestLocale, serverTranslations } from '@/features/i18n/server';
import { translateLegalContent } from '@/features/i18n/legal-content';

export async function LegalShell({title,children}:{title:string;children:React.ReactNode}){
  const locale = await requestLocale();
  const t = await serverTranslations();
  const identity=legalIdentity();
  return <main className="legal-page"><Link href="/login">{t('← Voltar ao acesso')}</Link><h1>{t(title)}</h1><p>{t('Versão')} {LEGAL_VERSION}{t('. Texto aplicável às funcionalidades descritas nesta versão.')}</p>
    {locale === 'en' && ['Termos de Uso', 'Política de Privacidade'].includes(title) && <p lang="en">English translation of the accepted Brazilian Portuguese version.</p>}
    <section aria-label={t('Identificação do responsável')}><h2>{t('Responsável e contato')}</h2>
      {identity.name&&identity.email?<><p>{identity.name}</p><p>{t('Canal de privacidade:')} <a href={`mailto:${identity.email}`}>{identity.email}</a></p>{identity.cnpj&&<p>{t('CNPJ:')} {identity.cnpj}</p>}{identity.address&&<p>{t('Endereço:')} {identity.address}</p>}</>:<p role="status">{t('Identificação e contato público em configuração. O cadastro real permanece indisponível até o preenchimento dessas informações. Nenhum encarregado ou CNPJ foi presumido.')}</p>}
    </section>{translateLegalContent(children, locale)}
  </main>;
}
