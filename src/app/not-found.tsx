import { serverTranslations } from '@/features/i18n/server';
import Link from 'next/link';
export default async function NotFound() {
  const t = await serverTranslations();
  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="eyebrow">{t('ESPAÇO NÃO ENCONTRADO')}</span>
        <h1>{t('Este caminho não está disponível.')}</h1>
        <p className="muted" style={{ margin: '20px 0' }}>
          {t('Verifique o endereço ou escolha uma empresa à qual você tem acesso.')}
        </p>
        <Link className="button primary" href="/onboarding">
          {t('Escolher empresa')}
        </Link>
      </section>
    </main>
  );
}
